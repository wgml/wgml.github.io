window.onkeyup = keyListener;

function keyListener(e) {
  console.log(e);
  if (acceptedKey(e)) {
    var s = document.getElementById("command-text");
    if (e.keyCode != 13) {
      s.innerHTML = s.innerHTML + e.key;
    }
    
    s = document.getElementById("command-input");
    s.value = "";
    if (e.keyCode == 13) {
      executeCommand();
    }
  }
}

function acceptedKey(event) {
  if (event.target == null || event.target.id !== "command-input") {
    return false;
  }
  return true;
}

function executeCommand() {
  var commands = document.getElementById("commands");
  var cursorWrap = document.getElementById("cursor-wrap");
  var newCursorWrap = cursorWrap.cloneNode(true);
  var cursor = document.getElementById("cursor");
  var input = document.getElementById("command-input").parentElement;

  console.log(commands);
  console.log(cursor);
  console.log(input);

  cursorWrap.removeChild(input);
  cursorWrap.removeChild(cursor);

  cursorWrap.removeAttribute("id");
  cursorWrap.removeAttribute("onclick");
  cursorWrap.classList.add("entered-command");
  cursorWrap.innerHTML += "<span><br/>error: command not found</span>";

  commands.appendChild(newCursorWrap);
}

function focusOnCommand() {
  console.log("focusOnCommand");
  document.getElementById("command-input").focus();
}