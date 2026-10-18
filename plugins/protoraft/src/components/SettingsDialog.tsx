import {
  CalendarClock,
  CalendarPlus,
  Globe2,
  GitBranch,
  Rocket,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { DisplayMode, ReviewStatus } from "../types";

export type ScheduledReviewCadence = "daily" | "weekdays" | "weekly";
export type ScheduledReviewEnvironment = "worktree" | "local";

export interface ScheduledReviewRequest {
  cadence: ScheduledReviewCadence;
  time: string;
  environment: ScheduledReviewEnvironment;
  timezone: string;
}

interface SettingsDialogProps {
  open: boolean;
  repositoryName: string;
  defaultBranch: string;
  displayMode: DisplayMode;
  reviewStatus?: ReviewStatus;
  branchChangeCount: number;
  schedulingAvailable: boolean;
  onClose: () => void;
  onDisplayModeChange: (mode: DisplayMode) => Promise<void>;
  onPublish: () => Promise<void>;
  onRequestSchedule: (request: ScheduledReviewRequest) => Promise<boolean>;
}

function formatCheckedAt(value?: string) {
  if (!value) {
    return "Not checked yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SettingsDialog({
  open,
  repositoryName,
  defaultBranch,
  displayMode,
  reviewStatus,
  branchChangeCount,
  schedulingAvailable,
  onClose,
  onDisplayModeChange,
  onPublish,
  onRequestSchedule,
}: SettingsDialogProps) {
  const [cadence, setCadence] =
    useState<ScheduledReviewCadence>("daily");
  const [time, setTime] = useState("09:00");
  const [environment, setEnvironment] =
    useState<ScheduledReviewEnvironment>("worktree");
  const [submitting, setSubmitting] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setChangingMode(false);
      setPublishing(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const hasUpdates =
    reviewStatus?.state === "updates-available" || branchChangeCount > 0;
  const reviewSummary =
    reviewStatus?.summary ??
    (branchChangeCount > 0
      ? `${branchChangeCount} branch ${
          branchChangeCount === 1 ? "change needs" : "changes need"
        } review`
      : "No pending review");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!schedulingAvailable) {
      return;
    }
    setSubmitting(true);
    try {
      await onRequestSchedule({
        cadence,
        time,
        environment,
        timezone,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = async (mode: DisplayMode) => {
    if (mode === displayMode || changingMode) {
      return;
    }
    setChangingMode(true);
    try {
      await onDisplayModeChange(mode);
    } finally {
      setChangingMode(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="dialog-layer" role="presentation">
      <button
        type="button"
        className="dialog-backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <section
        className="dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header>
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form className="settings-form" onSubmit={handleSubmit}>
          <section className="settings-section">
            <h3>Repository</h3>
            <dl className="settings-metadata">
              <div>
                <dt>Name</dt>
                <dd>{repositoryName}</dd>
              </div>
              <div>
                <dt>Default branch</dt>
                <dd>
                  <GitBranch size={14} />
                  {defaultBranch}
                </dd>
              </div>
            </dl>
          </section>

          <section className="settings-section">
            <h3>Display mode</h3>
            <label className="settings-select-control">
              <span>Mode</span>
              <select
                value={displayMode}
                disabled={changingMode}
                onChange={(event) =>
                  void changeMode(event.target.value as DisplayMode)
                }
              >
                <option value="local">Local (read &amp; write)</option>
                <option value="prod">Production (read only)</option>
              </select>
              <small>
                {displayMode === "local"
                  ? "Uses your working copy and branches"
                  : `Shows ${defaultBranch} without editing controls`}
              </small>
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>Publishing</h3>
              <span className="settings-host-label">
                <Globe2 size={14} />
                Codex Sites
              </span>
            </div>
            <div className="settings-publish-row">
              <div>
                <strong>{repositoryName}</strong>
                <small>Production · {defaultBranch}</small>
              </div>
              <button
                type="button"
                className="button button--primary"
                disabled={publishing}
                onClick={() => void publish()}
              >
                <Rocket size={16} />
                {publishing ? "Preparing" : "Publish current project"}
              </button>
            </div>
          </section>

          {displayMode === "local" && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <h3>Scheduled review</h3>
                  <p>Canvas freshness</p>
                </div>
                <span className="settings-host-label">
                  <CalendarClock size={14} />
                  {schedulingAvailable ? "Created by Codex" : "Requires Codex"}
                </span>
              </div>

              <div className="settings-field-grid">
                <label>
                  <span>Frequency</span>
                  <select
                    value={cadence}
                    onChange={(event) =>
                      setCadence(
                        event.target.value as ScheduledReviewCadence,
                      )
                    }
                  >
                    <option value="daily">Every day</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Every Monday</option>
                  </select>
                </label>
                <label>
                  <span>Time</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    required
                  />
                  <small>{timezone}</small>
                </label>
              </div>

              <label className="settings-select-control">
                <span>Run in</span>
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(
                      event.target.value as ScheduledReviewEnvironment,
                    )
                  }
                >
                  <option value="worktree">Isolated worktree</option>
                  <option value="local">Local checkout</option>
                </select>
              </label>

              <div className="settings-review-footer">
                <div
                  className={`settings-review-state ${
                    hasUpdates ? "has-updates" : ""
                  }`}
                >
                  <span className="settings-review-dot" aria-hidden="true" />
                  <div>
                    <strong>{reviewSummary}</strong>
                    <small>{formatCheckedAt(reviewStatus?.checkedAt)}</small>
                  </div>
                </div>
                {schedulingAvailable ? (
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={submitting}
                  >
                    <CalendarPlus size={16} />
                    {submitting ? "Requesting" : "Create scheduled task"}
                  </button>
                ) : (
                  <small className="settings-schedule-unavailable">
                    Open this project with the ProtoRaft plugin in Codex to
                    schedule it.
                  </small>
                )}
              </div>
            </section>
          )}
        </form>
      </section>
    </div>
  );
}
