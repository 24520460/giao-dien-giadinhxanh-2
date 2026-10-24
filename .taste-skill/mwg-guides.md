
--- Guide for animate-to-from-top-layer ---
# Animate Elements To and From Top Layer

Elements that render in the "top layer" (like `<dialog>`, elements with the `popover` attribute, or tooltips) have historically been difficult to animate because they toggle between `display: none` and a visible state. Modern CSS provides `@starting-style`, `transition-behavior: allow-discrete`, and the `overlay` property to enable smooth entry and exit transitions for these elements. Note that native CSS nesting is used in the examples below.

## Implementation

### 1. Enable Discrete Transitions

To animate the `display` property, you must set `transition-behavior: allow-discrete`. This allows the element to remain visible during its exit transition. If using transition shorthands, be sure to place the `transition-behavior: allow-discrete` afterwards to prevent the shorthand from negating it.

### 2. The `overlay` Property

When an element moves in or out of the top layer, it must transition the `overlay` property. This ensures the element stays in the top layer for the duration of the animation, preventing it from being clipped by other elements or the viewport prematurely.

### 3. Entry Animations with `@starting-style`

Use the `@starting-style` at-rule to define the styles an element should transition *from* when it is first rendered or its `display` changes from `none`.

### 4. Animating the Backdrop

The `::backdrop` pseudo-element can be animated similarly by applying transitions to its own properties.

## Example

```css
/* 1. Define the visible (open) state */
dialog[open],
[popover]:popover-open {
  opacity: 1;
  transform: scale(1);

  /* 2. Define the starting state for entry (must come after open state) */
  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* 3. Define the base (closed/exit) state and transitions */
dialog,
[popover] {
  opacity: 0;
  transform: scale(0.9);

  /* MANDATORY: transition display and overlay for top-layer elements */
  transition-property: opacity, transform, display, overlay;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  /* Applies to discrete properties like display and overlay */
  transition-behavior: allow-discrete; /* Note: be sure to write this after the shorthand */
}

/* 4. Animate the backdrop */
dialog::backdrop,
[popover]::backdrop {
  background-color: rgba(0, 0, 0, 0);
  transition-property: background-color, display, overlay;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  transition-behavior: allow-discrete;
}

dialog[open]::backdrop,
[popover]:popover-open::backdrop {
  background-color: rgba(0, 0, 0, 0.5);

  @starting-style {
    background-color: rgba(0, 0, 0, 0);
  }
}

/* 5. Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  dialog,
  [popover] {
    /* Disable movement and shorten duration for a simple fade */
    transform: none;
    transition-duration: 0.1s;
  }

  @starting-style {
    dialog[open],
    [popover]:popover-open {
      transform: none;
    }
  }
}
```

## Constraints & Accessibility

- **MANDATORY**: Include `overlay` in your `transition` list for any element moving into or out of the top layer.
- **MANDATORY**: Use `allow-discrete` for the `display` property transition.
- **MANDATORY**: Respect user preferences for reduced motion using `prefers-reduced-motion` by simplifying transitions (e.g., removing transforms and shortening duration).
- **DO**: Place the `@starting-style` block inside or after the "open" state selector to ensure proper cascading.
- **DO NOT**: Use `@starting-style` for exit animations; exit animations are defined by the transition to the base (closed) state.

## Fallback strategies

Baseline status for @starting-style: Newly available. It's been Baseline since 2024-08-06.
Supported by: Chrome 117 (Sep 2023), Edge 117 (Sep 2023), Firefox 129 (Aug 2024), and Safari 17.5 (May 2024).

Browser support for overlay: Limited availability.
Supported by: Chrome 117 (Sep 2023) and Edge 117 (Sep 2023).
Unsupported in: Firefox and Safari.

### Fallbacks & browser support for transition-behavior

Baseline status for transition-behavior: Newly available. It's been Baseline since 2024-08-06.
Supported by: Chrome 117 (Sep 2023), Edge 117 (Sep 2023), Firefox 129 (Aug 2024), and Safari 17.4 (Mar 2024).

Browser support for the css.properties.transition-behavior.transitionable_display capability: Limited availability.
Supported by: Chrome 117 (Sep 2023), Edge 117 (Sep 2023), and Safari 18 (Sep 2024).
Unsupported in: Firefox.

Firefox 129+ parses `transition-behavior: allow-discrete` (`CSS.supports('transition-behavior', 'allow-discrete')` returns `true`) without actually transitioning the `display` property (Firefox bug 1882408), causing elements to disappear immediately on exit.

To reliably detect discrete `display` transition support, probe whether a temporary element's computed `display` remains visible when transitioned to `none` rather than relying solely on `CSS.supports('transition-behavior', 'allow-discrete')`:

```javascript
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  // The shorthand is intentional here: browsers that don't parse allow-discrete
  // drop the whole declaration, so display: none applies instantly and the probe
  // correctly returns false. !important guards against global reduced-motion
  // resets like `* { transition: none !important }`.
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}
```

### Top-layer exit fallback

Entry animations work in pure CSS across all browsers that support `@starting-style`—no `.is-opening` class is needed because entry transitions do not depend on `overlay` or discrete `display` transitions.

Exit animations require both `overlay` and discrete `display` transition support. When either is unsupported (such as in Firefox and Safari), wrap the open-state selectors in `:is()` and append `:where(:not([data-closing]))` (nesting `&::backdrop` and `@starting-style`) so setting `data-closing` triggers the exit transition while the element remains in the top layer, then wait for `getAnimations()` to settle before calling `.close()` or `.hidePopover()`:

```css
:is(dialog[open], [popover]:popover-open):where(:not([data-closing])) {
  opacity: 1;
  transform: scale(1);

  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }

  &::backdrop {
    background-color: rgb(0 0 0 / 0.5);

    @starting-style {
      background-color: transparent;
    }
  }
}
```

```javascript
// Evaluate lazily: canTransitionDisplay() needs document.body, so a top-level
// const would be permanently false if this script runs in <head>.
function supportsTopLayerExit() {
  return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

async function closeTopLayer(element) {
  if (!supportsTopLayerExit()) {
    element.setAttribute('data-closing', '');
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    }
    if (!element.hasAttribute('data-closing')) return;
    element.removeAttribute('data-closing');
  }

  element.close();
  // Or for popover:
  // element.hidePopover();
}

// Route native close requests (Esc, closedby light dismiss) through the same
// helper so they animate too, instead of closing instantly.
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeTopLayer(dialog);
});
```

Popover light dismiss and `popovertarget` toggles cannot be intercepted (`beforetoggle` is only cancelable when opening), so in browsers that need the fallback those exits are instant. Provide an explicit close control that calls `closeTopLayer()` if the exit animation matters.

### Fallbacks & browser support for Popover

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).

The Popover API is mostly **progressive enhancement**, but its defining behaviors — top-layer promotion, light-dismiss, and `popovertarget` invocation — have no CSS-only equivalent. Older browsers need a polyfill, or a manual fallback if you would rather not ship one.

**Polyfill:** To support the `popover` attribute in older browsers, conditionally load [`@oddbird/popover-polyfill`](https://github.com/oddbird/popover-polyfill). **MANDATORY:** Feature detect by checking for the `popover` property on `HTMLElement.prototype`, and load the polyfill **only** when native support is missing — do NOT load it unconditionally.

With a bundler or import map:

```js
// MANDATORY: Feature detect 'popover' on HTMLElement.prototype.
if (!("popover" in HTMLElement.prototype)) {
  import("@oddbird/popover-polyfill");
}
```

Without a bundler, import from a CDN inside a `<script type="module">`:

```html
<script type="module">
  if (!("popover" in HTMLElement.prototype)) {
    import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js");
  }
</script>
```

**Styling caveat:** The polyfill cannot define the real `:popover-open` pseudo-class, so it applies a `.\:popover-open` class instead. **MANDATORY:** Combine the two with `:is()` or `:where()`, otherwise browsers that lack `:popover-open` discard the entire rule:

```css
[popover]:is(:popover-open, .\:popover-open) {
  display: block;
}
```

Alternatively, for a legacy fallback without a polyfill, use `position: fixed` and manually calculate coordinates via `getBoundingClientRect()` or rely on default positioning with `inset: auto` if that's acceptable for the use case.


--- Guide for validate-input-after-interaction ---
# Validate Input After Interaction

## The Problem

Displaying validation errors the moment a user focuses on a field and starts typing is premature and distracting. For example, as a user types an email address (e.g., "user@gm") or a password with complex requirements, the field is technically invalid until completion. Standard `:invalid` styling results in an error state appearing immediately, frustrating the user.

## The Solution

The `:user-invalid` pseudo-class allows you to defer the error state until the user has "committed" to a value (by blurring the field) or attempted to submit the form. This ensures validation feedback is provided only after the user has finished interacting with the field.

### Implementation Strategy

1.  **HTML Constraint**: DO use standard HTML5 attributes like `type="email"`, `pattern`, and `required` to trigger the browser's built-in validation logic.
2.  **Visual Feedback**: DO use `:user-invalid` to apply error styling only after interaction.
3.  **Positive Reinforcement**: DO optionally use `:user-valid` to give a green "success" indicator once the requirements are met.
4.  **Graceful Recovery**: As soon as the user corrects the input to a valid format, `:user-invalid` stops matching, removing the error state immediately.

## Implementation Guide

### Use Case 1: Email Validation

MANDATORY: Rely on standard HTML5 attributes for email fields. The error message is hidden by default and only revealed when the browser determines the user has left the field in an invalid state.

```html
<form>
  <div class="field">
    <label for="email">Email Address</label>
    <!-- MANDATORY: Place format hints above the input so autocomplete popovers don't cover them during editing -->
    <span id="email-hint" class="hint">Format: you@example.com</span>
    <!-- DO: Use standard HTML validation attributes like type="email" and required -->
    <input
      type="email"
      id="email"
      name="email"
      required
      autocomplete="email"
      aria-describedby="email-hint"
      aria-errormessage="email-error"
    >
    <div id="email-error" class="error-msg">
      <span aria-hidden="true">❌</span> Please enter a valid email address.
    </div>
  </div>
</form>
```

```css
.hint {
  display: block;
  color: #5f6368;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.error-msg {
  display: none;
  color: #d93025;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/*
  DO: Only show error styles after user interaction.
  Use multiple indicators (border/background shift + icon/text) to avoid color-only states.
*/
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* DO: Reveal the error message using the adjacent sibling selector */
input:user-invalid + .error-msg {
  display: block;
}

/* DO: Provide a clear success indication on :user-valid */
input:user-valid {
  border-color: #188038;
}
```

### Use Case 2: Password Complexity

MANDATORY: Define the complexity rule using a Regex Lookahead pattern in the `pattern` attribute. The rules list is shown above the input to guide the user, and highlighted if there's an error.

```html
<form>
  <div class="field">
    <label for="password">New Password</label>
    <!-- MANDATORY: Place hints and rules above the input so mobile keyboards do not obscure them -->
    <ul id="password-rules" class="rules-list">
      <li>At least 8 characters</li>
      <li>One uppercase letter</li>
      <li>One number</li>
      <li>One special character</li>
    </ul>
    <!-- DO: Use pattern and minlength for complex password validation
         DO: Match all constraints with lookaheads via pattern attribute
     -->
    <input
      type="password"
      id="password"
      autocomplete="new-password"
      required
      pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}"
      minlength="8"
      aria-describedby="password-rules"
    >
  </div>
</form>
```

```css
/* DO: State the default styling as neutral */
.rules-list { 
  color: #5f6368; 
  margin-bottom: 0.5rem;
}

/* DO: Show invalid state (After interaction): Error */
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* DO: Highlight rules list when error is shown using the modern :has() selector */
.field:has(input:user-invalid) .rules-list {
  color: #d93025;
  font-weight: 600;
}

/* DO: Add success indications for :user-valid state */
input:user-valid {
  border-color: #188038;
}

/* DO: Hide rules once satisfied */
.field:has(input:user-valid) .rules-list {
  display: none;
}
```

## Fallbacking & Browser Support

### Fallbacks & browser support for :user-valid and :user-invalid

Baseline status for :user-valid and :user-invalid: Widely available. It's been Baseline since 2023-11-02.
Supported by: Chrome 119 (Oct 2023), Edge 119 (Nov 2023), Firefox 88 (Apr 2021), and Safari 16.5 (May 2023).

### CSS for Fallback

```css
input:user-invalid,
input.user-invalid-fallback {
  border-color: #d93025;
  background-color: #fce8e6;
}

input:user-invalid + .error-msg,
input.user-invalid-fallback + .error-msg {
  display: block;
}
```

### JavaScript Fallback

Use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.

```javascript
const UserInvalidFallback = (() => {
  const dirtyState = new WeakMap();

  const updateState = (input) => {
    const isValid = input.checkValidity();

    // Update both visual and ARIA state
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);

    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const handleEvent = (event) => {
    const input = event.target;

    if (event.type === 'reset') {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback');
        control.classList.remove('user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }

    if (!input.checkValidity) return;

    if (event.type === 'input' || event.type === 'change') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(input, state);
      if (state.hasBlurred) {
        updateState(input);
      }
    } else if (event.type === 'blur') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(input, state);
      if (state.hasInteracted) {
        updateState(input);
      }
    }
  };

  const init = (root = document) => {
    if (CSS.supports('selector(:user-invalid)')) return;

    root.addEventListener('blur', handleEvent, true); // Capture phase
    root.addEventListener('input', handleEvent);
    root.addEventListener('change', handleEvent);
    root.addEventListener('reset', handleEvent, true); // Capture resets
  };

  return { init };
})();

// Initialize for a specific form
const form = document.querySelector('#demo-form');
UserInvalidFallback.init(form);
```

## Other Considerations

1.  **Accessibility**:
    *   MANDATORY: Use `aria-describedby` to link the rules list to the input.
    *   DO NOT: Hide rules lists entirely until the input is valid; users need to know what to type!
2.  **Pattern Attribute Limits**: MANDATORY: The `pattern` attribute performs a full match (implied `^...$`). Ensure your password regex accounts for the entire string.
3.  **Validation Strictness**: DO note that the browser's default `type="email"` validation is quite permissive (e.g., `user@localserver` might pass). If you need stricter validation, you may need to use a more robust validation library or a custom validation function alongside `type="email"`.
4.  **Focus Management**: MANDATORY: If a user submits the form with an invalid field, the browser will automatically focus the first invalid field. Your `:user-invalid` styles will apply immediately because a submission attempt counts as an interaction.
5. **Consistent ARIA Experience**: Native `:user-invalid` does not automatically sync with ARIA attributes. Add the following JavaScript to keep `aria-invalid` in sync with the visual state:

```javascript
// Sync aria-invalid with the CSS :user-invalid state
const syncAria = (el) => {
  el.setAttribute?.('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
};

// Update on blur (to show error) and input (to clear it)
document.addEventListener('blur', (e) => syncAria(e.target), true);
document.addEventListener('input', (e) => {
  if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
});
```

