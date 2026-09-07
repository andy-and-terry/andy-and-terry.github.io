(function () {
  var input = document.getElementById("input");
  var statWords = document.getElementById("stat-words");
  var statChars = document.getElementById("stat-chars");
  var statCharsNoSpace = document.getElementById("stat-chars-nospace");
  var statSentences = document.getElementById("stat-sentences");
  var statParagraphs = document.getElementById("stat-paragraphs");
  var statReading = document.getElementById("stat-reading");

  var WORDS_PER_MINUTE = 200;

  function countWords(text) {
    var trimmed = text.trim();
    if (trimmed === "") return 0;
    var matches = trimmed.match(/\S+/g);
    return matches ? matches.length : 0;
  }

  function countSentences(text) {
    var trimmed = text.trim();
    if (trimmed === "") return 0;
    // Split on sentence-ending punctuation followed by space/end; filter empties.
    var matches = trimmed.match(/[^.!?]+[.!?]+|\S+$/g);
    if (!matches) return trimmed === "" ? 0 : 1;
    return matches.filter(function (s) { return s.trim() !== ""; }).length;
  }

  function countParagraphs(text) {
    var trimmed = text.trim();
    if (trimmed === "") return 0;
    var parts = trimmed.split(/\n\s*\n/).filter(function (p) { return p.trim() !== ""; });
    return parts.length || (trimmed !== "" ? 1 : 0);
  }

  function formatReadingTime(words) {
    var totalSeconds = Math.round((words / WORDS_PER_MINUTE) * 60);
    if (totalSeconds < 60) return totalSeconds + "s";
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + "m " + seconds + "s";
  }

  function render() {
    var text = input.value;
    var words = countWords(text);
    statWords.textContent = words.toLocaleString();
    statChars.textContent = text.length.toLocaleString();
    statCharsNoSpace.textContent = text.replace(/\s/g, "").length.toLocaleString();
    statSentences.textContent = countSentences(text).toLocaleString();
    statParagraphs.textContent = countParagraphs(text).toLocaleString();
    statReading.textContent = formatReadingTime(words);
  }

  input.addEventListener("input", render);
  render();
})();
