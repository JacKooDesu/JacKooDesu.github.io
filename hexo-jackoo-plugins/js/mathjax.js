function load_mathjax() {
  MathJax.typeset();
}

const s = document.createElement("script");
s.id = "MathJax-script";
s.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";

document.body.appendChild(s);

MathJax = {
  tex: {
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
  },
};

// this is for the initial page load
window.addEventListener("load", load_mathjax);
// this is for swup.js
swup.hooks.on("content:replace", load_mathjax);
