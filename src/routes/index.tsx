import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel personal" },
      { name: "description", content: "Tu panel privado de universidad, tareas y correo." },
      { property: "og:title", content: "Panel personal" },
      { property: "og:description", content: "Tu panel privado de universidad, tareas y correo." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/inicio" });
  },
});
