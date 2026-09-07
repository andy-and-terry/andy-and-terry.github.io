(function () {
  var beforeEl = document.getElementById("before");
  var afterEl = document.getElementById("after");
  var wordModeEl = document.getElementById("word-mode");
  var output = document.getElementById("diff-output");
  var summary = document.getElementById("diff-summary");

  // Generic LCS-based diff over arrays of tokens. Returns a list of
  // {type: "equal"|"del"|"add", value} entries in order.
  function diffArrays(a, b) {
    var n = a.length,
      m = b.length;
    // DP table of LCS lengths, capped to avoid pathological memory use.
    var dp = new Array(n + 1);
    for (var i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for (i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var ops = [];
    i = 0;
    j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: "equal", value: a[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: "del", value: a[i] });
        i++;
      } else {
        ops.push({ type: "add", value: b[j] });
        j++;
      }
    }
    while (i < n) {
      ops.push({ type: "del", value: a[i] });
      i++;
    }
    while (j < m) {
      ops.push({ type: "add", value: b[j] });
      j++;
    }
    return ops;
  }

  // Guard against O(n*m) blowing up the browser on huge inputs.
  var MAX_CELLS = 4000000;

  function safeDiffArrays(a, b) {
    if (a.length * b.length > MAX_CELLS) {
      // Fall back to a coarse whole-block replace rather than hanging the tab.
      var ops = [];
      a.forEach(function (v) {
        ops.push({ type: "del", value: v });
      });
      b.forEach(function (v) {
        ops.push({ type: "add", value: v });
      });
      return ops;
    }
    return diffArrays(a, b);
  }

  function tokenizeWords(line) {
    // Split into words and the whitespace/punctuation between them, keeping all pieces.
    return line.match(/\s+|[^\s]+/g) || [];
  }

  function renderWordDiff(delLine, addLine) {
    var ops = safeDiffArrays(tokenizeWords(delLine), tokenizeWords(addLine));
    var delHtml = "";
    var addHtml = "";
    ops.forEach(function (op) {
      var text = escapeHtml(op.value);
      if (op.type === "equal") {
        delHtml += text;
        addHtml += text;
      } else if (op.type === "del") {
        delHtml += '<span class="diff-del">' + text + "</span>";
      } else {
        addHtml += '<span class="diff-add">' + text + "</span>";
      }
    });
    return { delHtml: delHtml, addHtml: addHtml };
  }

  function render() {
    var beforeText = beforeEl.value;
    var afterText = afterEl.value;
    var beforeLines = beforeText.split("\n");
    var afterLines = afterText.split("\n");

    if (beforeText === "" && afterText === "") {
      output.innerHTML = "";
      summary.textContent = "";
      return;
    }

    var ops = safeDiffArrays(beforeLines, afterLines);
    var wordMode = wordModeEl.checked;

    var html = [];
    var added = 0,
      removed = 0,
      unchanged = 0;

    var i = 0;
    while (i < ops.length) {
      var op = ops[i];
      if (op.type === "equal") {
        html.push('<span class="diff-line-equal">' + escapeHtml(op.value) + "\n</span>");
        unchanged++;
        i++;
        continue;
      }
      // Collect a contiguous run of del/add ops (a "replace block").
      var dels = [];
      var adds = [];
      while (i < ops.length && ops[i].type === "del") {
        dels.push(ops[i].value);
        i++;
      }
      while (i < ops.length && ops[i].type === "add") {
        adds.push(ops[i].value);
        i++;
      }
      removed += dels.length;
      added += adds.length;

      if (wordMode && dels.length === adds.length) {
        // Pair up equal-count replace blocks line by line for word-level highlighting.
        for (var k = 0; k < dels.length; k++) {
          var wd = renderWordDiff(dels[k], adds[k]);
          html.push('<span class="diff-line-del">' + wd.delHtml + "\n</span>");
          html.push('<span class="diff-line-add">' + wd.addHtml + "\n</span>");
        }
      } else {
        dels.forEach(function (v) {
          html.push('<span class="diff-line-del">' + escapeHtml(v) + "\n</span>");
        });
        adds.forEach(function (v) {
          html.push('<span class="diff-line-add">' + escapeHtml(v) + "\n</span>");
        });
      }
    }

    output.innerHTML = html.join("");
    summary.textContent = unchanged + " unchanged, " + added + " added, " + removed + " removed (lines)";
  }

  beforeEl.addEventListener("input", render);
  afterEl.addEventListener("input", render);
  wordModeEl.addEventListener("change", render);
  render();
})();
