(function () {
  var unitEl = document.getElementById("unit");
  var countEl = document.getElementById("count");
  var wordbankEl = document.getElementById("wordbank");
  var classicStartEl = document.getElementById("classic-start");
  var output = document.getElementById("output");
  var copyBtn = document.getElementById("copy-btn");

  var BANKS = {
    classic: (
      "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et " +
      "dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip " +
      "ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu " +
      "fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt " +
      "mollit anim id est laborum"
    ).split(" "),
    tech: (
      "synergy disrupt scalable pivot bandwidth roadmap iterate stakeholder onboarding leverage cloud native " +
      "microservice pipeline latency deploy sprint backlog velocity refactor api endpoint container orchestration " +
      "serverless algorithm dashboard metrics analytics growth hacking mvp prototype bootstrapped runway unicorn " +
      "ecosystem framework paradigm optimize automate integrate"
    ).split(" "),
    corporate: (
      "synergize leverage circle back deep dive low hanging fruit bandwidth touch base actionable deliverable " +
      "value add core competency paradigm shift best practice thought leadership win win holistic streamline " +
      "empower alignment stakeholder buy in move the needle drill down granular takeaway ideate incentivize " +
      "operationalize scalable robust framework strategic"
    ).split(" "),
  };

  function pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function makeSentence(bank, minWords, maxWords) {
    var n = minWords + Math.floor(Math.random() * (maxWords - minWords + 1));
    var words = [];
    for (var i = 0; i < n; i++) words.push(pick(bank, Math.random));
    var sentence = words.join(" ");
    // Occasionally insert a comma for readability.
    if (n > 6 && Math.random() < 0.5) {
      var pos = 3 + Math.floor(Math.random() * (n - 5));
      var parts = sentence.split(" ");
      parts[pos] = parts[pos] + ",";
      sentence = parts.join(" ");
    }
    return capitalize(sentence) + ".";
  }

  function makeParagraph(bank, sentenceCount) {
    var sentences = [];
    for (var i = 0; i < sentenceCount; i++) sentences.push(makeSentence(bank, 6, 16));
    return sentences.join(" ");
  }

  function generate() {
    var unit = unitEl.value;
    var count = parseInt(countEl.value, 10);
    if (!Number.isFinite(count) || count < 1) count = 1;
    if (count > 200) count = 200;
    countEl.value = count;

    var bank = BANKS[wordbankEl.value] || BANKS.classic;
    var text = "";

    if (unit === "words") {
      var words = [];
      if (classicStartEl.checked) {
        var starter = "lorem ipsum dolor sit amet consectetur adipiscing elit".split(" ");
        words = starter.slice(0, Math.min(count, starter.length));
      }
      while (words.length < count) words.push(pick(bank, Math.random));
      text = capitalize(words.join(" ")) + ".";
    } else if (unit === "sentences") {
      var sentences = [];
      if (classicStartEl.checked) {
        sentences.push("Lorem ipsum dolor sit amet, consectetur adipiscing elit.");
      }
      while (sentences.length < count) sentences.push(makeSentence(bank, 6, 16));
      text = sentences.slice(0, count).join(" ");
    } else {
      var paragraphs = [];
      for (var p = 0; p < count; p++) {
        var sentenceCount = 3 + Math.floor(Math.random() * 3);
        var para = makeParagraph(bank, sentenceCount);
        if (p === 0 && classicStartEl.checked) {
          para = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + para;
        }
        paragraphs.push(para);
      }
      text = paragraphs.join("\n\n");
    }

    output.textContent = text;
  }

  [unitEl, countEl, wordbankEl, classicStartEl].forEach(function (el) {
    el.addEventListener("input", generate);
    el.addEventListener("change", generate);
  });
  countEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") generate();
  });

  copyBtn.addEventListener("click", function (e) {
    copyText(output.textContent, e.currentTarget);
  });

  generate();
})();
