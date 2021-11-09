if (
  document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  makeExpandable();
} else {
  document.addEventListener("DOMContentLoaded", makeExpandable);
}


function makeExpandable() {
  var codeBlocks = document.getElementsByTagName("code");

  var buttonArray = new Array;
  for (let i = 0; i < codeBlocks.length; i++){
    var expandButton = document.createElement('div');
    expandButton.className = "expand-button";
    expandButton.innerHTML = 'Expand';
    expandButton.id = "button-"+i;

    buttonArray.push(expandButton)
  }


  for (let i = 0; i < codeBlocks.length; i++){
    codeBlocks[i].classList.add("collapsed-code-block");
    codeBlocks[i].id = "block-"+i;

    var fadeout = document.createElement('div');
    fadeout.className = "fadout";

    buttonArray[i].addEventListener('click', function (event) {
      expandClick(codeBlocks[i].id, buttonArray[i].id);
    });
    
    codeBlocks[i].appendChild(buttonArray[i]);
  }
}

function expandClick(blockId, buttonId) {
  if (document.getElementById(blockId))
    document.getElementById(blockId).classList.remove("collapsed-code-block");
  if (document.getElementById(buttonId))
    document.getElementById(buttonId).remove();
}