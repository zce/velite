---
title: Style Guide
slug: style-guide
date: 1970-01-01 00:00:00
cover: cover.jpg
---

Below is just about everything you’ll need to style in the theme. Check the source code to see the many embedded elements within paragraphs.

---

### Headings

# Heading 1

<!-- more -->

Doloremque dolor voluptas est sequi omnis. Pariatur ut aut. Sed enim tempora qui veniam qui cum vel. Voluptas odit at vitae minima. In assumenda ut. Voluptatem totam impedit accusantium reiciendis excepturi aut qui accusamus praesentium.

## Heading 2

Doloremque dolor voluptas est sequi omnis. Pariatur ut aut. Sed enim tempora qui veniam qui cum vel. Voluptas odit at vitae minima. In assumenda ut. Voluptatem totam impedit accusantium reiciendis excepturi aut qui accusamus praesentium.

### Heading 3

Doloremque dolor voluptas est sequi omnis. Pariatur ut aut. Sed enim tempora qui veniam qui cum vel. Voluptas odit at vitae minima. In assumenda ut. Voluptatem totam impedit accusantium reiciendis excepturi aut qui accusamus praesentium.

#### Heading 4

Doloremque dolor voluptas est sequi omnis. Pariatur ut aut. Sed enim tempora qui veniam qui cum vel. Voluptas odit at vitae minima. In assumenda ut. Voluptatem totam impedit accusantium reiciendis excepturi aut qui accusamus praesentium.

##### Heading 5

Doloremque dolor voluptas est sequi omnis. Pariatur ut aut. Sed enim tempora qui veniam qui cum vel. Voluptas odit at vitae minima. In assumenda ut. Voluptatem totam impedit accusantium reiciendis excepturi aut qui accusamus praesentium.

###### Heading 6

Doloremque dolor voluptas est sequi omnis. Pariatur ut aut. Sed enim tempora qui veniam qui cum vel. Voluptas odit at vitae minima. In assumenda ut. Voluptatem totam impedit accusantium reiciendis excepturi aut qui accusamus praesentium.

---

## Paragraph

It's very easy to make some words **bold** and other words _italic_ with Markdown. You can even [link to Google!](http://google.com)

Lorem ipsum dolor sit amet, test link adipiscing elit. This is strong. Nullam dignissim convallis est. Quisque aliquam. This is emphasized. Donec faucibus. Nunc iaculis suscipit dui. 53 = 125. Water is H2O. Nam sit amet sem. Aliquam libero nisi, imperdiet at, tincidunt nec, gravida vehicula, nisl. The New York Times (That’s a citation). Underline. Maecenas ornare tortor. Donec sed tellus eget sapien fringilla nonummy. Mauris a ante. Suspendisse quam sem, consequat at, commodo vitae, feugiat in, nunc. Morbi imperdiet augue quis tellus.

HTML and CSS are our tools. Mauris a ante. Suspendisse quam sem, consequat at, commodo vitae, feugiat in, nunc. Morbi imperdiet augue quis tellus. Praesent mattis, massa quis luctus fermentum, turpis mi volutpat justo, eu volutpat enim diam eget metus. To copy a file type COPY filename. Dinner’s at 5:00. Let’s make that 7. This text has been struck.

#### Emphasis

_This text will be italic_\
_This will also be italic_\
**This text will be bold**\
**This will also be bold**\
_You **can** combine them_

#### Preformatted Text

The silver swan, who living had no note,\
When death approached, unlocked her silent throat;\
Leaning her breast against the reedy shore,\
Thus sung her first and last, and sung no more:\
Farewell, all joys; O death, come close mine eyes;\
More geese than swans now live, more fools than wise.

#### Text-level semantics

The [a element](#foo) example\
The <abbr>abbr element</abbr> and <abbr title="Title text">abbr element with title</abbr> examples\
The **b element** example\
The <cite>cite element</cite> example\
The `code element` example\
The ~~del element~~ example\
The <dfn>dfn element</dfn> and <dfn title="Title text">dfn element with title</dfn> examples\
The _em element_ example\
The _i element_ example\
The <ins>ins element</ins> example\
The <kbd>kbd element</kbd> example\
The <mark>mark element</mark> example\
The <q>q element <q>inside</q> a q element</q> example\
The <s>s element</s> example\
The <samp>samp element</samp> example\
The <small>small element</small> example\
The <span>span element</span> example\
The <strong>strong element</strong> example\
The <sub>sub element</sub> example\
The <sup>sup element</sup> example\
The <var>var element</var> example\
The <u>u element</u> example

#### Footnotes

You can create footnotes like this[^footnote].

---

### List Types

#### Ordered List

Sometimes you want numbered lists:

1. List Item 1
2. List Item 2
3. Nested list item A
4. Nested list item B
5. List Item 3

#### Unordered List

Sometimes you want bullet points:

- List Item 1
- List Item 2
  - Nested list item A
  - Nested list item B
- List Item 3

Alternatively,

- Start a line with a star
- Profit!

But I have to admit, tasks lists are my favorite:

- [x] This is a complete item
- [ ] This is an incomplete item

#### Definition List

<dl>
  <dt>Definition List Title</dt>
  <dd>This is a definition list division.</dd>
  <dt>Definition</dt>
  <dd>An exact statement or description of the nature, scope, or meaning of something: <em>our definition of what constitutes poetry.</em></dd>
</dl>

---

### Blockquotes

Let’s keep it simple. Italics are good to help set it off from the body text. Be sure to style the citation.

> Good afternoon, gentlemen. I am a HAL 9000 computer. I became operational at the H.A.L. plant in Urbana, Illinois on the 12th of January 1992. My instructor was Mr. Langley, and he taught me to sing a song. If you’d like to hear it I can sing it for you.
> — [HAL 9000](http://en.wikipedia.org/wiki/HAL_9000)

And here’s a bit of trailing text.

---

### Table

If you want to embed table, this is how you do it:

| TABLE HEADER 1 | TABLE HEADER 2 | TABLE HEADER 3 |
| -------------- | -------------- | -------------- |
| Division 1     | Division 2     | Division 3     |
| Division 1     | Division 2     | Division 3     |
| Division 1     | Division 2     | Division 3     |

| Name   | Age     | Sex | Location |
| ------ | ------- | --- | -------- | ------ |
| Naruto | Uzumaki | 16  | Male     | Konoha |
| Sakura | Haruno  | 16  | Female   | Konoha |

---

### Code

Code can be presented inline, like `<?php bloginfo('stylesheet_url'); ?>`, or within a `<pre>` block. Because we have more specific typographic needs for code, we’ll specify Consolas and Monaco ahead of the browser-defined monospace font.

```css
.banner {
  width: 750px;
  height: 420px;
}

.banner image {
  width: 100%;
  height: 100%;
}
```

```javascript
import React from 'react'

import { Wrapper } from '../components'

export default () => (
  <Wrapper title="Hello world">
    <h1>Hello world</h1>
  </Wrapper>
)
```

---

### Media

Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.

#### Wide Image

![Wide Image](img-03.jpg)

#### Big Image

![Big Image](img-01.jpg)

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

#### Small Image

Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.

![Small Image](img-02.jpg)

Labore et dolore.

[^footnote]: Here is the _text_ of the **footnote**.
