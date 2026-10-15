# Velite

Velite derives a type-safe data layer from content sources. The following terms distinguish source analysis from navigation through build-time content.

## Language

**Content Definition**:
An explicit dialect and configuration choice for deriving related outputs from selected content. Reusing a definition expresses that the outputs belong together; separately created definitions remain distinct.
_Avoid_: Primary schema, inferred configuration group

**Source Content**:
The selected Markdown or MDX text interpreted according to its dialect, before content transformations. It is distinct from the content produced by those transformations.
_Avoid_: Rendered content, final page

**Source Analysis**:
Information derived from Source Content, such as an excerpt or reading metadata. It does not describe changes introduced by content transformations or runtime rendering.
_Avoid_: Rendered-content analysis

**Build-time Content**:
The content structure determined by build-time processing. Content that becomes known only through runtime expression or component evaluation is outside this concept.
_Avoid_: Final page, rendered DOM

**Heading Anchor**:
The identifier on an output heading that serves as its navigation target. It is distinct from a slug calculated independently from the heading's title.
_Avoid_: Title slug

**Navigation TOC**:
A table of contents describing the navigable headings and their actual targets in Build-time Content. It is distinct from an outline of the original source headings or a list of title-derived slugs.
_Avoid_: Source outline, slug list

**Content Result**:
The related outputs of one content processing, including generated content and its Navigation TOC. Source Analysis, when requested, retains its pre-transformation meaning.
_Avoid_: Independent render-and-outline results
