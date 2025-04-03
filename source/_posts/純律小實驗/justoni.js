(function () {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  let HREF_PROTOCAL = "justoni://";
  let context = new AudioContext();
  console.log("Justoni");

  let arr = [...document.getElementsByTagName("a")];

  arr.forEach((e) => {
    if (!e.href.startsWith(HREF_PROTOCAL)) return;

    let caller = makeCaller(e.href.replace(HREF_PROTOCAL, ""));

    e.onclick = (_) => playSndByPath(context, caller);

    e.removeAttribute("href");
  });
})();

function makeCaller(uri) {
  let items = uri.split(",").map((p) => {
    let arr = p.split("/");
    // 0 part is id
    let source = document.getElementById(arr[0]);
    if (!source) return;

    // 1 part is path
    let pathArr = arr[1].split("_").map((p) => (obj) => obj[p]);

    // 2 part is eval,
    // division operator use `!`
    if (arr[2])
      pathArr.push((obj) => eval(`${obj}${arr[2].replace("!", "/")}`));

    return { source: source, pathArr: pathArr };
  });

  return items;
}

function playSndByPath(context, items) {
  let hzArr = items.map((item) => {
    let hz = item.source;
    item.pathArr.forEach((fn) => (hz = fn(hz)));

    return hz;
  });

  playChord(context, hzArr);
}

function playChord(context, hzArray) {
  let arr = [],
    volume = 0.2 / hzArray.length, // Reduce volume to prevent clipping
    seconds = 0.5;

  for (let i = 0; i < context.sampleRate * seconds; i++) {
    arr[i] =
      hzArray.reduce(
        (sum, hz) => sum + sineWaveAt(i, context.sampleRate, hz),
        0
      ) * volume;
  }

  let buf = new Float32Array(arr);
  let buffer = context.createBuffer(1, buf.length, context.sampleRate);
  buffer.copyToChannel(buf, 0);
  let source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}

function playSnd(context, hz) {
  let arr = [],
    volume = 0.2,
    seconds = 0.5;

  for (let i = 0; i < context.sampleRate * seconds; i++) {
    arr[i] = sineWaveAt(i, context.sampleRate, hz) * volume;
  }

  let buf = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) buf[i] = arr[i];
  let buffer = context.createBuffer(1, buf.length, context.sampleRate);
  buffer.copyToChannel(buf, 0);
  let source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
}

function sineWaveAt(sampleNumber, rate, tone) {
  let sampleFreq = rate / tone;
  return Math.sin(sampleNumber / (sampleFreq / (Math.PI * 2)));
}
