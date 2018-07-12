window.onkeyup = keyListener;

function keyListener(e) {
  console.log(e);
  if (acceptedKey(e)) {
    console.log("Event is accepted")
    var s = document.getElementById("cursor");
    if (e.keyCode != 13) {
      s.innerHTML = s.innerHTML + e.key;
    }
    
    s = document.getElementById("cursor-input");
    s.value = "";
    if (e.keyCode == 13) {
      executeCommand();
    }

    s.focus();
  }
}

function acceptedKey(event) {
  if (event.target == null || event.target.id !== "cursor-input") {
    return false;
  }

  if (event.keyCode == 13) {
    return true; // Enter key
  }

  if (event.key.length != 1) {
    return false;
  }

  return true;
}

function processCommand(cmd) {
  return cmd + ": command not found";
}

function executeCommand() {
  var shell = document.getElementById("shell");
  var cursor = document.getElementById("cursor");
  var input = document.getElementById("cursor-input");
  var lastCommand = cursor.parentElement;
  var nextCommand = lastCommand.cloneNode(true);

  var cmd = cursor.innerText;

  cursor.removeChild(input);
  cursor.removeAttribute("id");

  lastCommand.removeAttribute("onclick");
  
  var cmdResult = processCommand(cmd);
  shell.innerHTML += "<p class=\"command-result\">" + cmdResult + "</p>";

  shell.appendChild(nextCommand);
  var h = document.getElementById("cursor").innerHTML;
  document.getElementById("cursor").innerHTML = h.substr(0, h.length - cmd.length);
  focusOnCommand();
}

function focusOnCommand() {
  console.log("focusOnCommand");
  document.getElementById("cursor-input").focus();
}