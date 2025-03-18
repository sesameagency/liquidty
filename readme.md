# Liquidity


### This is an experiment to see if I can optimize the use of React and SCSS in my Shopify theme development workflow

## The criteria
1. I only have to write the jsx in the template section file once and have it compile to HTML
2. The jsx can contain liquid code and still compile to html during dev for SEO
3. Any liquid variables should maintain their integrity during the prerender and be parsed by Shopify as expected
4. The React app should be hydrated on the client side seemlessly
5. I want to write scss in the same section file and have it compile to css in place
6. I want my schema to be in JS not JSON (nice to have)



## What to expect

An example file at the following location
`/src/sections/example.liquid`

```liquid
<script type="text/babel">
  function App() {
    return <div>{{sectioin.settings.title}}</div>
  }
</script>

{% schema %}
  {
    "name": "Minimal Example",
    "settings": [
      {
        "type": "text",
        "id": "title",
        "label": "Title",
        "default": "My Title"
      }
    ],
    "presets": [
      {
        "name": "Minimal Example"
      }
    ]
  }
{% endschema %}
```

can be compiled to valid liquid in the theme's section directory
`/sections/example.liquid`

```liquid
<div class="root root-7770641847050777">
  <div>{{ sectioin.settings.title }}</div>
</div>
<script type="module">
  "use strict";
  function App() {
    return /*#__PURE__*/ React.createElement("div", null, "{{sectioin.settings.title}}");
  }
  ReactDOMClient.createRoot(document.querySelector("#shopify-section-{{section.id}} .root-7770641847050777")).render(
    React.createElement(App),
  );
</script>
{% schema %}
{
  "name": "Minimal Example",
  "settings": [
    {
      "type": "text",
      "id": "title",
      "label": "Title",
      "default": "My Title"
    }
  ],
  "presets": [
    {
      "name": "Minimal Example"
    }
  ]
}
{% endschema %}
```



# Limitations

## Rendering Snippets

Be careful when rendering snippets, especially inline SVG with double quotes. To avoid conflicts, it's best to use `dangerouslySetInnerHTML` and backticks.

**Example:**

```
<svg width="90" height="86">...<svg>
```

To properly render this in JSX or React, you should use backticks:

```
`{% render 'example.svg.liquid' %}`
```

Using backticks ensures that React handles line breaks and special characters correctly in the compiled code.

Example in React:

```
/*#__PURE__*/React.createElement("div", {
  className: "prevBtn btn",
  dangerouslySetInnerHTML: {
    __html: `<svg width="90" height="86">
      ...
    </svg>`
  }
})
```

## Liquid Tags Inside Style Declarations

Liquid tags are not yet supported inside style object declarations in JSX. Avoid embedding Liquid tags directly within style properties.

### Incorrect Example:

```
<div style={{
  background: 'red',
  {% if shouldUseColor %}
    color: 'blue',
  {% endif %}
}} />
```

### Correct Example:

Instead, use template literals (backticks) for the style property values when embedding Liquid tags:

```
<div style={{
  background: 'red',
  color: `
    {% if shouldUseColor %}
      blue
    {% endif %}
  `,
}} />
```

This ensures that the Liquid tags are properly processed and do not cause any issues in the JSX style declaration.



# Requirements

Make sure React and ReactDOM are available in the global scope (aka window.React) of your theme.

`<script src="https://unpkg.com/react@18/umd/react.development.js"></script>`
`<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>`





# Get in touch


`joseph@sesameagency.co`


