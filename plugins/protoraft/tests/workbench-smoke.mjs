import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { build } from "esbuild";

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
const generatedPng = process.argv[3];
if (!source) throw new Error("Pass the local ProtoRaft-Sample Git directory. An optional second argument supplies a generated PNG.");
const endpoint = process.env.PROTORAFT_TEST_CDP ?? "http://127.0.0.1:9333";
const scratch = await mkdtemp(join(tmpdir(), "protoraft-workbench-smoke-"));
const root = join(scratch, "Morrow");
const clients = [];
let browserConnection;
let pageConnection;
let targetId;
let server;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
}

async function connectMcp() {
  const client = new Client({ name: "ProtoRaft smoke", version: "1" });
  clients.push(client);
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [join(plugin, "dist/server.mjs"), "--stdio"],
    cwd: plugin, stderr: "pipe",
  }));
  return client;
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((ok, fail) => {
    socket.addEventListener("open", ok, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const response = JSON.parse(data);
    pending.get(response.id)?.(response);
  });
  return {
    disconnect() { socket.close(); },
    send(method, params = {}) {
      const currentId = ++id;
      return new Promise((ok, fail) => {
        const timer = setTimeout(() => {
          pending.delete(currentId);
          fail(new Error(`CDP timed out: ${method}`));
        }, 10000);
        pending.set(currentId, ({ error, result }) => {
          pending.delete(currentId);
          clearTimeout(timer);
          if (error) fail(new Error(error.message));
          else ok(result);
        });
        socket.send(JSON.stringify({ id: currentId, method, params }));
      });
    },
  };
}

const host = `
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
const frame = document.createElement("iframe");
document.body.append(frame);
const rpc = async (path, body) => (await fetch(path, { method: "POST", body: JSON.stringify(body) })).json();
const bridge = new AppBridge(null, { name: "Smoke host", version: "1" }, { serverTools: {}, message: { text: {} } });
bridge.oncalltool = params => rpc("/tool", params);
bridge.onmessage = params => rpc("/message", params);
bridge.onrequestdisplaymode = async ({ mode }) => ({ mode });
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult(await rpc("/open", {}));
};
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
frame.src = "/app";
`;

try {
  git(scratch, "clone", "--quiet", "--no-hardlinks", resolve(source), root);
  git(root, "branch", "--track", "feature/morrow-listen", "origin/feature/morrow-listen");
  const client = await connectMcp();
  const peer = await connectMcp();
  const call = (name, args, connection = client) => connection.callTool({ name, arguments: args });
  const checked = async (name, args, connection) => {
    const response = await call(name, args, connection);
    assert.equal(response.isError, undefined, response.content?.[0]?.text);
    assert.ok(response.structuredContent, name);
    return response.structuredContent;
  };
  const { project } = await checked("open_protoraft_workbench", { rootPath: root });
  const projectId = project.projectId;
  await checked("open_protoraft_workbench", { rootPath: root }, peer);
  const toolList = await client.listTools();
  const openTool = toolList.tools.find((tool) => tool.name === "open_protoraft_workbench");
  const resource = await client.readResource({ uri: openTool._meta.ui.resourceUri });
  const appHtml = resource.contents[0].text;
  const hostResult = await build({
    stdin: { contents: host, resolveDir: plugin },
    bundle: true, write: false, format: "esm", platform: "browser",
  });
  const calls = [];
  const messages = [];
  let reviewHtml = "";
  server = createServer(async (request, response) => {
    try {
      if (request.method === "GET") {
        if (request.url === "/host.js") {
          response.setHeader("content-type", "text/javascript");
          response.end(hostResult.outputFiles[0].text);
          return;
        }
        const pages = {
          "/": '<meta charset="utf-8"><style>body{margin:0}iframe{width:100vw;height:100vh;border:0;display:block}</style><script type="module" src="/host.js"></script>',
          "/app": appHtml,
          "/web": appHtml,
          "/review": reviewHtml,
        };
        response.setHeader("content-type", "text/html; charset=utf-8");
        const path = new URL(request.url, "http://localhost").pathname;
        response.statusCode = Object.hasOwn(pages, path) ? 200 : 404;
        response.end(pages[path] ?? "Not found");
        return;
      }
      let body = "";
      for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      let result;
      if (request.url === "/tool") {
        result = await call(input.name, input.arguments);
        if (input.name !== "get_protoraft_asset") calls.push({ name: input.name, args: input.arguments, result });
      } else if (request.url === "/open") {
        result = await call("open_protoraft_workbench", { rootPath: root });
      } else if (request.url === "/message") {
        messages.push(...input.content.map((part) => part.text));
        result = {};
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(result ?? {}));
    } catch (error) {
      response.statusCode = 500;
      response.end(JSON.stringify({ isError: true, content: [{ type: "text", text: String(error) }] }));
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${server.address().port}`;

  const { webSocketDebuggerUrl } = await (await fetch(`${endpoint}/json/version`)).json();
  browserConnection = await connectCdp(webSocketDebuggerUrl);
  ({ targetId } = await browserConnection.send("Target.createTarget", { url: "about:blank", background: true }));
  const targets = await (await fetch(`${endpoint}/json/list`)).json();
  const target = targets.find((entry) => entry.id === targetId);
  assert.ok(target, "Locate the exact target created for this test");
  pageConnection = await connectCdp(target.webSocketDebuggerUrl);
  const evaluate = async (fn, ...args) => {
    const { result, exceptionDetails } = await pageConnection.send("Runtime.evaluate", {
      expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(result.description ?? exceptionDetails.text);
    return result.value;
  };
  const wait = async (label, fn, ...args) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const value = await evaluate(fn, ...args);
        if (value) return value;
      } catch (error) {
        if (!/context/i.test(error.message)) throw error;
      }
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const has = (value, selector = "body") => wait(value, (value, selector) => {
    const doc = document.querySelector("iframe")?.contentDocument ?? document;
    return doc.querySelector(selector)?.innerText.includes(value);
  }, value, selector);
  const click = (value, selector = "body") => wait(value, (value, selector) => {
    const doc = document.querySelector("iframe")?.contentDocument ?? document;
    const control = [...doc.querySelectorAll(`${selector} button`)].find((button) =>
      (!button.disabled && (button.getAttribute("aria-label")?.replace(", updates available", "") ?? button.innerText.trim()) === value));
    if (!control) return false;
    control.click();
    return true;
  }, value, selector);
  const setField = (selector, value, append = false) => wait(selector, (selector, value, append) => {
    const doc = document.querySelector("iframe")?.contentDocument ?? document;
    const field = doc.querySelector(selector);
    if (!field || field.disabled) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value").set;
    setter.call(field, append ? field.value + value : value);
    const event = field.tagName === "SELECT" ? "change" : "input";
    field.dispatchEvent(new doc.defaultView.Event(event, { bubbles: true }));
    return true;
  }, selector, value, append);
  const fieldValue = (selector) => evaluate((selector) =>
    (document.querySelector("iframe")?.contentDocument ?? document).querySelector(selector)?.value, selector);
  const last = (name) => calls.findLast((entry) => entry.name === name);
  const checkCanvas = () => has("Morrow", ".status-project-name");

  await pageConnection.send("Page.navigate", { url });
  await checkCanvas();
  await has("Connected", ".status-connection");
  await click("Documents");
  await click("Edit");
  const docPath = join(root, "documents/product-brief.md");
  const original = await readFile(docPath, "utf8");
  const concurrentText = "An editor changed this file on disk.";
  const draftText = "Draft: default to 1×.";
  await setField(".document-editor", `\n${draftText}\n`, true);
  await writeFile(docPath, `${original}\n${concurrentText}\n`);
  await click("Save");
  await has("The repository version changed");
  await has(concurrentText, ".write-conflict");
  assert.match(await fieldValue(".document-editor"), /Draft: default to/);
  assert.ok(last("save_protoraft_document").args.expectedRevision);
  assert.equal(last("save_protoraft_document").result.isError, true);
  assert.doesNotMatch(await readFile(docPath, "utf8"), /Draft: default/);

  await click("Wireframes");
  await click("Documents");
  await click("Edit");
  assert.match(await fieldValue(".document-editor"), /Draft: default to/);
  await setField(".document-editor", `\n${concurrentText}\n`, true);
  await click("Keep draft and use latest revision");
  await click("Save");
  await has("Document saved.");
  const savedDoc = await readFile(docPath, "utf8");
  assert.ok(savedDoc.includes(concurrentText) && savedDoc.includes(draftText));
  const savedRevision = last("save_protoraft_document").result.structuredContent.saved.revision;
  const competingDocs = await Promise.all([client, peer].map((connection, index) =>
    call("save_protoraft_document", {
      projectId, path: "documents/product-brief.md", content: `${savedDoc}\nWindow ${index}\n`,
      expectedRevision: savedRevision,
    }, connection)));
  assert.equal(competingDocs.filter((item) => !item.isError).length, 1);
  const winningEdit = competingDocs.findIndex((item) => !item.isError);
  assert.match(await readFile(docPath, "utf8"), new RegExp(`Window ${winningEdit}`));
  console.log("PASS document conflict, draft recovery, and separate MCP process concurrency");

  await click("Wireframes");
  await click("Open wireframe");
  const raw = await checked("get_protoraft_project", { projectId }, peer);
  const existingNotesRevision = raw.project.discussionRevision;
  const peerNote = await checked("add_protoraft_discussion_note", {
    projectId, screenId: "story", body: "Peer note saved while the modal was open.",
  }, peer);
  const pending = "Keep this note in the draft during a conflict.";
  const discussionsPath = join(root, "documents/discussions.json");
  await setField('[aria-label="Discussion note"]', pending);
  await click("Add note");
  await has("The discussion changed", ".write-feedback");
  assert.equal(await fieldValue('[aria-label="Discussion note"]'), pending);
  assert.equal(last("add_protoraft_discussion_note").result.isError, true);
  assert.doesNotMatch(await readFile(discussionsPath, "utf8"), /Keep this note/);
  assert.notEqual(peerNote.saved.revision, existingNotesRevision);
  await click("Add note");
  await has(pending, ".discussion-notes");
  assert.match(await readFile(discussionsPath, "utf8"), /Keep this note/);
  await click("Close wireframe preview", ".wireframe-review");

  const reopened = await checked("get_protoraft_project", { projectId });
  const concurrent = await Promise.all([client, peer].map((connection, index) =>
    call("add_protoraft_discussion_note", {
      projectId, screenId: "story", body: `Concurrent note ${index}`,
      expectedRevision: reopened.project.discussionRevision,
    }, connection)));
  const winner = concurrent.findIndex((item) => !item.isError);
  assert.equal(concurrent.filter((item) => !item.isError).length, 1);
  const latest = await checked("get_protoraft_project", { projectId });
  await checked("add_protoraft_discussion_note", {
    projectId, screenId: "story", body: `Concurrent note ${1 - winner}`,
    expectedRevision: latest.project.discussionRevision,
  });
  const discussions = await readFile(discussionsPath, "utf8");
  assert.ok(discussions.includes("Concurrent note 0") && discussions.includes("Concurrent note 1"));
  console.log("PASS note conflict feedback, retry, and separate MCP process concurrency");

  const submit = async () => {
    await click("Generate screen");
    await setField(".dialog textarea", "Choose the default playback speed from an overlay.");
    await setField(".dialog input", "Playback speed");
    await setField(".dialog select", "Overlay state");
    await click("Generate wireframe", ".dialog");
    await wait("generation dialog closed after acknowledgement", () => {
      const doc = document.querySelector("iframe")?.contentDocument;
      return Boolean(doc?.querySelector(".wireframe-requests")) && !doc.querySelector("#generate-screen-title");
    });
    return last("create_wireframe_request").result.structuredContent.request;
  };
  const first = await submit();
  await has(first.id, ".wireframe-requests");
  const second = await submit();
  assert.notEqual(first.id, second.id);
  assert.ok(messages.some((message) => message.includes(projectId) && message.includes(first.id)));
  assert.ok(messages.some((message) => message.includes(projectId) && message.includes(second.id)));

  const abandoned = await checked("claim_wireframe_request", { projectId, requestId: second.id, agentName: "qa-second" });
  await checked("fail_wireframe_request", {
    projectId, requestId: second.id, claimToken: abandoned.request.claimToken, error: "Simulated generation failure.",
  });
  await has("Simulated generation failure.", ".wireframe-requests");
  await click("Retry", ".wireframe-requests");
  await wait("retry ready to resend", () => {
    const doc = document.querySelector("iframe")?.contentDocument;
    return Boolean(doc?.querySelector(".wireframe-requests")) &&
      ![...doc.querySelectorAll(".wireframe-requests button")].some((button) => button.innerText.includes("Sending"));
  });
  assert.equal(last("retry_wireframe_request").args.requestId, second.id);

  const claimed = await checked("claim_wireframe_request", { projectId, requestId: first.id, agentName: "qa-first" });
  assert.ok(claimed.rootPath.endsWith("/Morrow"));
  const { output } = claimed;
  await mkdir(join(root, dirname(output.screenDefinitionPath)), { recursive: true });
  const image = generatedPng ? resolve(generatedPng) : join(root, "screens/listen/wireframe.png");
  await copyFile(image, join(root, output.wireframePath));
  await writeFile(join(root, output.screenDefinitionPath), JSON.stringify({
    id: output.screenId, title: first.title, purpose: first.purpose,
    route: "/listen/speed", wireframe: "wireframe.png",
  }));
  await checked("complete_wireframe_request", {
    projectId, requestId: first.id, claimToken: claimed.request.claimToken, ...output,
  });
  await has("Ready", ".wireframe-requests");
  await click("Open result", ".wireframe-requests");
  await has("Playback speed", ".wireframe-review");
  const decoded = () => {
    const doc = document.querySelector("iframe")?.contentDocument ?? document;
    return doc.querySelector(".wireframe-review-canvas img")?.naturalWidth > 0;
  };
  await wait("new wireframe image decoded", decoded);
  const graph = await checked("get_protoraft_project", { projectId });
  assert.ok(graph.project.connections.some((edge) => edge.source === first.sourceScreenId && edge.target === output.screenId));
  await pageConnection.send("Page.reload");
  await checkCanvas();
  await has(first.id, ".wireframe-requests");
  await click("Open result", ".wireframe-requests");
  await has("Playback speed", ".wireframe-review");
  const generatedNote = "This discussion is attached to the generated screen.";
  await setField('[aria-label="Discussion note"]', generatedNote);
  await click("Add note");
  await has(generatedNote, ".discussion-notes");
  const resultNotes = JSON.parse(await readFile(discussionsPath, "utf8")).notes;
  assert.ok(resultNotes.some((note) => note.body === generatedNote && note.screenId === output.screenId));
  await click("Close wireframe preview", ".wireframe-review");
  console.log("PASS same-title requests, retry, generated PNG on live canvas and after reopen");

  await click("Review", ".sidebar");
  await has("Product decision pending");
  await has("No Git conflict flagged");
  await click("Scan branches");
  await has("Branch comparison refreshed.");
  assert.ok(last("compare_protoraft_branches").args.includeReview);
  const pickChangedPath = (path) => wait(path, (path) => {
    const doc = document.querySelector("iframe")?.contentDocument ?? document;
    const choice = [...doc.querySelectorAll(".change-list button")].find((button) => button.textContent.includes(path));
    choice?.click();
    return Boolean(choice);
  }, path);
  await pickChangedPath("screens/listen/wireframe.png");
  const twoImages = () => {
    const doc = document.querySelector("iframe")?.contentDocument ?? document;
    const images = [...doc.querySelectorAll(".comparison-versions img")];
    return images.length === 2 && images.every((image) => image.naturalWidth > 0);
  };
  await wait("local comparison wireframes decoded", twoImages);
  await pickChangedPath("documents/interaction-spec.md");
  const decision = "Keep playback on Story and Saved when the full player closes.";
  await setField(".review-decision textarea", decision);
  await click("Save decision");
  await has("Product decision recorded");
  assert.match(await readFile(join(root, "collaboration/review-scenarios.json"), "utf8"), /Keep playback on Story and Saved/);
  console.log("PASS real branch scan, side-by-side committed images, durable review decision");

  const feature = join(scratch, "feature");
  git(root, "worktree", "add", feature, "feature/morrow-listen");
  await copyFile(join(root, "collaboration/review-scenarios.json"), join(feature, "collaboration/review-scenarios.json"));
  const featureBriefPath = join(feature, "documents/product-brief.md");
  await writeFile(featureBriefPath, (await readFile(featureBriefPath, "utf8")) + "\n[Read the playback rules](./interaction-spec.md)\n");
  git(feature, "add", "collaboration/review-scenarios.json", "documents/product-brief.md");
  git(feature, "-c", "user.name=ProtoRaft Smoke", "-c", "user.email=smoke@example.com", "commit", "-m", "Record playback decision");
  const commit = git(feature, "rev-parse", "HEAD");
  await click("Settings", ".sidebar");
  await setField(".settings-publish-row select", "branch-review");
  await has(commit.slice(0, 12), ".settings-publish-row");
  await click("Publish snapshot");
  await has("Site publish request sent to Codex.");
  const site = last("prepare_protoraft_site").result.structuredContent.site;
  assert.equal(site.commit, commit);
  assert.ok(messages.at(-1).includes(commit));
  reviewHtml = await readFile(join(site.sourceDirectory, "dist/static/index.html"), "utf8");
  assert.ok(!reviewHtml.includes(concurrentText), "Export contains only committed content");

  await pageConnection.send("Page.navigate", { url: `${url}/review` });
  await has("Read only");
  await has(decision, ".review-decision");
  await pickChangedPath("screens/listen/wireframe.png");
  await wait("shared comparison wireframes decoded", twoImages);
  await click("Product", ".sidebar");
  await click("Documents");
  await wait("all five embedded document images decoded", () => {
    const images = [...document.querySelectorAll(".markdown-document img")];
    return images.length === 5 && images.every((image) => image.naturalWidth > 0);
  });
  await wait("internal document link", () => {
    const link = [...document.querySelectorAll(".markdown-document a")].find((item) => item.textContent === "Read the playback rules");
    link?.click();
    return Boolean(link);
  });
  await has("interaction-spec.md", ".document-meta");
  await pageConnection.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await has("Read only");
  console.log("PASS committed branch and commit, read-only browser review, Markdown images and document link");

  await pageConnection.send("Page.navigate", { url: `${url}/web` });
  await has("Preview data");
  await click("Documents");
  await click("Edit");
  await setField(".document-editor", "\nPreview copy only.\n", true);
  await click("Save");
  await has("Saved to this preview until reload.");
  await pageConnection.send("Page.reload");
  await has("Preview data");
  await click("Documents");
  const text = await evaluate(() => document.body.innerText);
  assert.ok(!text.includes("Preview copy only."));
  console.log("PASS standalone preview labels its temporary edit");

  const demoUrl = `${url}/web?preview=morrow`;
  await pageConnection.send("Page.navigate", { url: demoUrl });
  await wait("mobile Morrow preview", () => Boolean(document.querySelector(".direct-preview button")));
  await pageConnection.send("Emulation.clearDeviceMetricsOverride");
  await pageConnection.send("Page.reload");
  await wait("desktop Morrow preview", () => Boolean(document.querySelector(".direct-preview button")));
  console.log("PASS standalone Morrow preview on mobile and desktop");
} finally {
  try {
    if (targetId) await browserConnection.send("Target.closeTarget", { targetId });
  } finally {
    pageConnection?.disconnect();
    browserConnection?.disconnect();
    server?.closeAllConnections();
    server?.close();
    await Promise.all(clients.map((client) => client.close()));
    await rm(scratch, { recursive: true, force: true });
  }
}
