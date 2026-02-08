export interface NavItem {
  title: string;
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const docsNav: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Local Development", href: "/docs/local-dev" },
      { title: "Testnet Deployment", href: "/docs/testnet" },
    ],
  },
  {
    title: "Architecture",
    items: [
      { title: "Overview", href: "/docs/architecture" },
      { title: "Contracts", href: "/docs/contracts" },
      { title: "REST API", href: "/docs/api" },
      { title: "MCP Server", href: "/docs/mcp" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "Design Decisions", href: "/docs/decisions" },
      { title: "Security", href: "/docs/security" },
    ],
  },
];
