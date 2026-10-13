---
layout: home

title: Velite
titleTemplate: 让创造性内容更简单

hero:
  name: Velite
  text: 让创造性内容更简单
  tagline: 内容优先应用的新选择
  image:
    src: /assets/icon.svg
    alt: Velite Logo
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/quick-start
    - theme: alt
      text: 在 GitHub 上查看
      link: https://github.com/zce/velite

features:
  - icon: 🤩
    title: 开箱即用
    details: 将 Markdown / MDX、YAML、JSON 或其他文件转换为应用数据层。
  - icon: 💪
    title: 类型安全
    details: 基于 Zod 模式的内容字段验证，同时自动生成的 TypeScript 类型。
  - icon: 🚀
    title: 轻量高效
    details: 轻量高效，仍然强大，启动更快，性能更好。
  - icon: 🗂️
    title: 资源处理
    details: 内置资源处理，例如相对路径文件解析、图像优化等。
---

::: warning 中文文档状态

本站目前只有此落地页完成了中文翻译，完整文档仅提供英文版本。点击上方「快速上手」将进入英文指南；欢迎通过 [GitHub](https://github.com/zce/velite) 提交中文翻译的 PR。

:::

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
