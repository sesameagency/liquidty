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
{% comment %} this will be preserved {% endcomment %}
{% assign sectionId = section.id %}
{% assign backgroundColor = '#00272b' %}

<script type="text/babel">
  // all type="text/babel" script will compile in place
  function App() {
		// IMPORTANT: you must have a function called App in your script tag
    const [title, setTitle] = React.useState('{{section.settings.title}}'); // you can use a string like this
    const [count, setCount] = React.useState({{section.settings.startCount | json}}); // or no quotes but make sure you use the json directive

    let otherColor = 'red';
    {% if product == blank %}
      otherColor = 'green';
    {% endif %}

    return (
      <div
        className="example"
        style={{
					backgroundColor: {{backgroundColor | json}}, /* still working on bug where the jsx compiler adds px to the end for some reason */
					'--backgroundColor': {{backgroundColor | json}}, /*  this is good though */
				}}
      >
				{/* don't worry the double bracket here won't be detected as a liquid variable */}
        <h1 className="title" onClick={() =>  setTitle('changed')}>Title: {title}</h1>
        <p className="sectionId">SectionId: {{sectionId}}</p>
        <div className="count" onClick={() => setCount(Number(count) + 1)}>
          {count}
        </div>
        {% if product != blank %}
          <div className="productId">Product ID: {{product.id | json}}</div>
        {% endif %}
      </div>
    );
  }
</script>

<style type="text/scss">
	/* protect your css using the section.id namespace */
	/* div.root wraps the html generated from the jsx so we can hydrate the App */
  #shopify-section-{{section.id}} .root {
    .example {
      min-height: 500px;
      width: 100%;
			background-color: var(--backgroundColor);

			/* you can also use liquid vars here */
      color: {{section.settings.textColor}};

			/* you can add conditional logic as well */
			{% if section.settings.shouldHaveBorder %}
				border: 1px solid pink;
			{% endif %}

      .title {
        color: var(--textColor);
      }

      .count {
        padding: 25px;
        border-radius: 10px;
        background: cyan;
				color: black;
        width: fit-content;
      }
    }
  }
</style>

<script id="schema">
	// I prefer my schema to be js but it's optional
	// you can use a regular schema liquid tag if you like.
  ({
    name: 'Example',
    settings: [
      {
        type: 'text',
        id: 'title',
        label: 'Title',
        default: 'My Title',
      },
      {
        type: 'number',
        id: 'startCount',
        label: 'Start Count',
        default: 1,
      },
      {
        type: 'color',
        id: 'backgroundColor',
        label: 'Background Color',
        default: '#000',
      },
      {
        type: 'color',
        id: 'textColor',
        label: 'Text Color',
        default: '#fff',
      },
      {
        type: 'checkbox',
        id: 'shouldHaveBorder',
        label: 'Should Have Border',
        default: false,
      },
    ],
    presets: [
      {
        name: 'Example',
      },
    ],
  });
</script>
```

can be compiled to valid liquid in the theme's section directory
`/sections/example.liquid`

```liquid
{% comment %} this will be preserved {% endcomment %}
{% assign sectionId = section.id %}
{% assign backgroundColor = '#00272b' %}

<div class="root root-7778789254860777">
  <div
    class="example"
    style="background-color:{{backgroundColor | json}}px;--backgroundColor:{{backgroundColor | json}}"
  >
    <h1 class="title">
      Title:
      <!--  -->
      {{ section.settings.title }}
    </h1>
    <p class="sectionId">SectionId: {{ sectionId }}</p>
    <div class="count">{{ section.settings.startCount | json }}</div>
    {% if product != blank %}
      <div class="productId">Product ID: {{ product.id | json }}</div>
    {% endif %}
  </div>
</div>
<script type="module">
  				"use strict";

  // all type="text/babel" script will compile in place
  function App() {
    // IMPORTANT: you must have a function called App in your script tag
    const [title, setTitle] = React.useState("{{section.settings.title}}"); // you can use a string like this
    const [count, setCount] = React.useState({{section.settings.startCount | json}}); // or no quotes but make sure you use the json directive

    let otherColor = "red";
    {% if product == blank %};
    otherColor = "green";
    {% endif %};
    return /*#__PURE__*/React.createElement("div", {
      className: "example",
      style: {
        backgroundColor: {{backgroundColor | json}} /* still working on bug where the jsx compiler adds px to the end for some reason */,
        "--backgroundColor": {{backgroundColor | json}} /*  this is good though */
      }
    }, /*#__PURE__*/React.createElement("h1", {
      className: "title",
      onClick: () => setTitle("changed")
    }, "Title: ", title), /*#__PURE__*/React.createElement("p", {
      className: "sectionId"
    }, "SectionId: {{sectionId}}"), /*#__PURE__*/React.createElement("div", {
      className: "count",
      onClick: () => setCount(Number(count) + 1)
    }, count), "{% if product != blank %}", /*#__PURE__*/React.createElement("div", {
      className: "productId"
    }, "Product ID: {{product.id | json}}"), "{% endif %}");
  }
  				ReactDOMClient
  					.createRoot(document.querySelector('#shopify-section-{{section.id}} .root-7778789254860777'))
  					.render(React.createElement(App));
</script>

<style>
  /* protect your css using the section.id namespace */
  /* div.root wraps the html generated from the jsx so we can hydrate the App */
  #shopify-section-{{section.id}} .root .example {
    min-height: 500px;
    width: 100%;
    background-color: var(--backgroundColor);
    /* you can also use liquid vars here */
    color: {{section.settings.textColor}};
    /* you can add conditional logic as well */
    {% if section.settings.shouldHaveBorder %}
    border: 1px solid pink;
    {% endif %}
  }
  #shopify-section-{{section.id}} .root .example .title {
    color: var(--textColor);
  }
  #shopify-section-{{section.id}} .root .example .count {
    padding: 25px;
    border-radius: 10px;
    background: cyan;
    color: black;
    width: fit-content;
  }
</style>

{% schema %}
{
  "name": "Example",
  "settings": [
    {
      "type": "text",
      "id": "title",
      "label": "Title",
      "default": "My Title"
    },
    {
      "type": "number",
      "id": "startCount",
      "label": "Start Count",
      "default": 1
    },
    {
      "type": "color",
      "id": "backgroundColor",
      "label": "Background Color",
      "default": "#000"
    },
    {
      "type": "color",
      "id": "textColor",
      "label": "Text Color",
      "default": "#fff"
    },
    {
      "type": "checkbox",
      "id": "shouldHaveBorder",
      "label": "Should Have Border",
      "default": false
    }
  ],
  "presets": [
    {
      "name": "Example"
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


