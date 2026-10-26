import { defineLayout, type Layout } from "tessera";

import { MODULES } from "./modules";

export interface Example {
  id: string;
  title: string;
  layout: Layout;
}

export const EXAMPLES: Example[] = [
  {
    id: "sidebar",
    title: "Sidebar",
    layout: defineLayout(MODULES, {
      version: 1,
      root: {
        split: "row",
        resizable: true,
        children: [
          { module: "list", props: { title: "Nav" }, size: "240px", minSize: "160px" },
          {
            split: "column",
            resizable: true,
            children: [
              { module: "note", props: { title: "Main" }, size: 3 },
              { module: "readout", props: { label: "Info" }, size: 1 },
            ],
          },
        ],
      },
    }),
  },
  {
    id: "units",
    title: "Units",
    layout: defineLayout(MODULES, {
      root: {
        split: "row",
        resizable: true,
        children: [
          { module: "readout", props: { label: "20%" }, size: "20%" },
          { module: "readout", props: { label: "12rem" }, size: "12rem" },
          { module: "readout", props: { label: "Share 1" }, size: 1 },
          { module: "readout", props: { label: "Share 2" }, size: 2 },
          { module: "readout", props: { label: "200px" }, size: "200px" },
        ],
      },
    }),
  },
  {
    id: "grid",
    title: "Fixed grid",
    layout: defineLayout(MODULES, {
      root: {
        split: "column",
        children: [
          {
            split: "row",
            children: [
              { module: "swatch", props: { label: "A", color: "#4f7cff" } },
              { module: "swatch", props: { label: "B", color: "#2fb37a" } },
              { module: "swatch", props: { label: "C", color: "#e2a33b" } },
            ],
          },
          {
            split: "row",
            size: 2,
            children: [
              { module: "readout", props: { label: "Share 2" }, size: 2 },
              { module: "readout", props: { label: "Share 1" } },
            ],
          },
        ],
      },
    }),
  },
  {
    id: "nested",
    title: "Nested resizable",
    layout: defineLayout(MODULES, {
      root: {
        split: "column",
        resizable: true,
        children: [
          {
            split: "row",
            resizable: true,
            size: 2,
            children: [
              { module: "note", props: { title: "Left" } },
              { module: "note", props: { title: "Right" }, minSize: "200px" },
            ],
          },
          { module: "readout", props: { label: "Bottom 30%" }, size: "30%" },
        ],
      },
    }),
  },
  {
    id: "edge-cases",
    title: "Edge cases",
    layout: {
      root: {
        split: "row",
        children: [
          { module: "calendar" },
          { module: "readout", props: { label: "Transparent tile" }, background: "transparent" },
          { module: "swatch", props: { label: "Own background", color: "transparent" }, background: "#7a3cff" },
        ],
      },
    },
  },
  {
    id: "single",
    title: "Single tile",
    layout: defineLayout(MODULES, { root: { module: "note", props: { title: "Only tile" } } }),
  },
];
