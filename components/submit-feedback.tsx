"use client";

import { useEffect } from "react";

/**
 * Every mutation in this app is a plain form post to a server action, so a tap gives no
 * feedback until the redirect lands. One document-level listener covers every submit
 * button — including future ones — instead of wrapping twenty call sites.
 */
export function SubmitFeedback() {
  useEffect(() => {
    function onSubmit(event: Event) {
      const button = (event as SubmitEvent).submitter;
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;

      // Defer past this task: the browser builds FormData while dispatching submit, so
      // disabling here cannot drop a submit button's own name/value.
      requestAnimationFrame(() => {
        button.disabled = true;
        button.dataset.pending = "true";
        button.setAttribute("aria-busy", "true");
      });
    }

    // Back/forward cache can restore a page with a button still marked in flight.
    function reset() {
      for (const element of document.querySelectorAll("[data-pending='true']")) {
        element.removeAttribute("data-pending");
        element.removeAttribute("aria-busy");
      }
    }

    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", reset);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", reset);
    };
  }, []);

  return null;
}
