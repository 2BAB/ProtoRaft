interface WorkspaceSubnavItem<T extends string> {
  id: T;
  label: string;
}

interface WorkspaceSubnavProps<T extends string> {
  label: string;
  active: T;
  items: Array<WorkspaceSubnavItem<T>>;
  onChange: (id: T) => void;
}

export function WorkspaceSubnav<T extends string>({
  label,
  active,
  items,
  onChange,
}: WorkspaceSubnavProps<T>) {
  return (
    <div className="workspace-subnav" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={active === item.id ? "is-active" : ""}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
