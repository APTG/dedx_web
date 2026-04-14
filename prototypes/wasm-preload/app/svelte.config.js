import adapter from "@sveltejs/adapter-static";

export default {
  kit: {
    adapter: adapter({ fallback: "404.html" }),
    paths: {
      // Simulate GitHub Pages sub-path: /dedx_web/
      base: process.env.BASE_PATH || "",
    },
  },
};
