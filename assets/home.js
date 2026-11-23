"use strict";
/* Landing page: the canvases sit side by side in a horizontal scroller (swipe, trackpad or
   keyboard). The arrows, shown on hover, page one canvas left/right and hide at either end. */
document.querySelectorAll("[data-carousel]").forEach((car) => {
  const track = car.querySelector(".car-track");
  const prev = car.querySelector(".car-prev");
  const next = car.querySelector(".car-next");
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // one step = one slide + the gap = the track's inner width (see .car-track in style.css)
  const page = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
  const update = () => {
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  };

  prev.addEventListener("click", () => page(-1));
  next.addEventListener("click", () => page(1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); page(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); page(1); }
  });
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
});
