import {
  GitCompareArrows,
  LayoutGrid,
  Network,
  Settings,
} from "lucide-react";
import type { DisplayMode, WorkspaceSection } from "../types";

interface SidebarProps {
  activeSection: WorkspaceSection;
  displayMode: DisplayMode;
  reviewAttention: boolean;
  showSettings: boolean;
  showSharedReview: boolean;
  onSectionChange: (section: WorkspaceSection) => void;
  onOpenSettings: () => void;
}

const navigation: Array<{
  id: WorkspaceSection;
  label: string;
  icon: typeof Network;
}> = [
  { id: "product", label: "Product", icon: Network },
  { id: "design", label: "Design", icon: LayoutGrid },
  {
    id: "collaboration",
    label: "Review",
    icon: GitCompareArrows,
  },
];

export function Sidebar({
  activeSection,
  displayMode,
  reviewAttention,
  showSettings,
  showSharedReview,
  onSectionChange,
  onOpenSettings,
}: SidebarProps) {
  const visibleNavigation =
    displayMode === "prod" && !showSharedReview
      ? navigation.filter((item) => item.id !== "collaboration")
      : navigation;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="sidebar-wordmark">
          <strong>ProtoRaft</strong>
          <small>v0.1</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          const hasAttention =
            item.id === "collaboration" && reviewAttention;
          return (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? "is-active" : ""}
              aria-label={`${item.label}${
                hasAttention ? ", updates available" : ""
              }`}
              title={item.label}
              onClick={() => onSectionChange(item.id)}
            >
              <Icon size={18} strokeWidth={1.7} />
              {hasAttention && (
                <span className="sidebar-attention-dot" aria-hidden="true" />
              )}
              <span className="sidebar-nav-label">{item.label}</span>
              <span className="rail-tooltip" role="tooltip">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {showSettings && (
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-settings"
            aria-label="Settings"
            title="Settings"
            onClick={onOpenSettings}
          >
            <Settings size={18} strokeWidth={1.7} />
            <span className="rail-tooltip" role="tooltip">
              Settings
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
