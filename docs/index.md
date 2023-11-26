---
layout: home

title: Velite
titleTemplate: Make Creative Contents Easy

hero:
  name: Velite
  text: Make Creative Contents Easy
  tagline: New Choices for Content-first Apps
  image:
    src: /assets/icon.svg
    alt: Velite Logo
  actions:
    - theme: brand
      text: Get Started
      link: ./guide/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/zce/velite

features:
  - icon: 📦
    title: Out of the Box
    details: Turns your Markdown, YAML, JSON, or other files into application data layer.
  - icon: 😍
    title: Type-safe Contents
    details: Content Fields validation based on Zod schema, and auto-generated TypeScript types.
  - icon: 🚀
    title: Light & Efficient
    details: Light-weight & High efficiency & Still powerful, faster startup, and better performance.
  - icon: 🗂️
    title: Assets Processing
    details: Built-in Assets Processing, such as relative path resolving, image optimization, etc.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(45deg, #11E49D 30%, #13AAAA);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #08A77199 50%, #04D0D099 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}

.image-src {
  width: 100%;
  height: 100%;
  animation: logo 2s infinite alternate;
}

@keyframes logo {
  75%, 100% {
    transform: translate(-50%, -50%) scale(1.02) translateY(-6px);
    opacity: 0.9;
  }
}
</style>
