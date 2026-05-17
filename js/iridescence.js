/**
 * Iridescence-фон для hero (ванильный WebGL2, без ES-модулей и CDN).
 * Работает при открытии index.html с диска (file://).
 */
(function () {
  var VERT = "#version 300 es\nin vec2 position;\nout vec2 vUv;\nvoid main() {\n  vUv = position * 0.5 + 0.5;\n  gl_Position = vec4(position, 0.0, 1.0);\n}\n";

  var FRAG = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform float uTime;\nuniform vec3 uColor;\nuniform vec3 uResolution;\nuniform vec2 uMouse;\nuniform float uAmplitude;\nuniform float uSpeed;\nout vec4 outColor;\nvoid main() {\n  float mr = min(uResolution.x, uResolution.y);\n  vec2 uv = (vUv * 2.0 - 1.0) * uResolution.xy / mr;\n  uv += (uMouse - vec2(0.5)) * uAmplitude;\n  float d = -uTime * 0.5 * uSpeed;\n  float a = 0.0;\n  for (float i = 0.0; i < 8.0; ++i) {\n    a += cos(i - d - a * uv.x);\n    d += sin(uv.y * i + a);\n  }\n  d += uTime * 0.5 * uSpeed;\n  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);\n  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;\n  outColor = vec4(col, 1.0);\n}\n";

  function themeColor() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return dark ? [0.13, 0.77, 0.37] : [0.09, 0.64, 0.29];
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("Shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function mount(container) {
    if (!container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    var gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
    if (!gl) {
      container.classList.add("hero-bg--fallback");
      return;
    }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      container.classList.add("hero-bg--fallback");
      return;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Program:", gl.getProgramInfoLog(prog));
      container.classList.add("hero-bg--fallback");
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var locPos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(prog, "uTime");
    var uColor = gl.getUniformLocation(prog, "uColor");
    var uRes = gl.getUniformLocation(prog, "uResolution");
    var uMouse = gl.getUniformLocation(prog, "uMouse");
    var uAmp = gl.getUniformLocation(prog, "uAmplitude");
    var uSpeed = gl.getUniformLocation(prog, "uSpeed");

    gl.uniform1f(uAmp, 0.12);
    gl.uniform1f(uSpeed, 1.0);
    gl.uniform2f(uMouse, 0.5, 0.5);

    function setColor() {
      var c = themeColor();
      gl.uniform3f(uColor, c[0], c[1], c[2]);
    }
    setColor();

    function resize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (w < 2 || h < 2) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(uRes, canvas.width, canvas.height, canvas.width / canvas.height);
    }

    resize();
    window.addEventListener("resize", resize);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resize).observe(container);
    }

    var host = container.closest(".hero") || container;
    host.addEventListener("mousemove", function (e) {
      var r = host.getBoundingClientRect();
      gl.uniform2f(uMouse, (e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    });

    new MutationObserver(setColor).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    container.classList.add("hero-bg--active");

    var raf;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      gl.uniform1f(uTime, t * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    mount(document.getElementById("heroIridescence"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
