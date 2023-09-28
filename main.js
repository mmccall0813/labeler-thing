let canvas = document.querySelector("canvas");
let ctx = canvas.getContext("2d");
let image = new Image();
image.src = "randomIcon.png";

image.onload = draw;

let mode = "idle";
let boxes = [];

let cursorPos = [0, 0];
let dragStart = [0, 0];
let dragEnd = [0, 0];
let dragging = false;

function onResize(){
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
}
onResize();
window.addEventListener("resize", onResize);

function getMousePos(c, evt) {
    var rect = c.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

canvas.addEventListener("mousedown", (e) => {
    if(e.button != 0 || mode !== "newbox") return;
    dragging = true;
    let pos = getMousePos(canvas, e);
    dragStart = [pos.x, pos.y];
});
canvas.addEventListener("mousemove", (e) => {
    let pos = getMousePos(canvas, e);
    cursorPos = [pos.x, pos.y];
    if(dragging) dragEnd = cursorPos;
    draw();
});
window.addEventListener("mouseup", (e) => {
    if(e.button != 0) return;
    if(dragging) dragging = false;
    draw();
});

window.addEventListener("keydown", (e) => {
    switch(e.key){
        case "Escape":
            dragging = false;
            mode = "idle";
            draw();
        break;
        case "w":
            if (mode === "idle") mode = "newbox";
        break;
    }
    draw();
})

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    let maxHeight = canvas.height - 50;
    let maxWidth = canvas.width - 50;
    let ratio = image.naturalWidth / image.naturalHeight;
    let size = [image.naturalWidth, image.naturalHeight];
    
    // try height scaling, then try width scaling
    if(image.naturalHeight > maxHeight){
        size[0] = Math.floor(maxHeight * ratio);
        size[1] = maxHeight;
    }
    if(image.naturalWidth > maxWidth){
        size[0] = maxWidth;
        size[1] = Math.floor(maxWidth / ratio);
    }
    let imagePos = [canvas.width / 2 - size[0] / 2, canvas.height / 2 - size[1] /2];
    
    ctx.drawImage(image, imagePos[0], imagePos[1], size[0], size[1])

    if(mode === "newbox" && !dragging){
        // is cursor in bounds of the image?
        if((cursorPos[0] >= imagePos[0] && (cursorPos[0] <= imagePos[0] + size[0])) && (cursorPos[1] >= imagePos[1] && (cursorPos[1] <= imagePos[1] + size[1]))){
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#000000"
            ctx.beginPath();
            ctx.moveTo(cursorPos[0], imagePos[1]);
            ctx.lineTo(cursorPos[0], imagePos[1] + size[1]);
            ctx.moveTo(imagePos[0], cursorPos[1]);
            ctx.lineTo(imagePos[0] + size[0], cursorPos[1]);
            ctx.closePath();
            ctx.stroke();
        }
    }

    // verify that a drag has started INSIDE the image, if not, disable dragging varible
    if(dragging){
        // yes, this is copy pasted from the crosshair bounds
        if(!((dragStart[0] >= imagePos[0] && (dragStart[0] <= imagePos[0] + size[0])) && (dragStart[1] >= imagePos[1] && (dragStart[1] <= imagePos[1] + size[1])))){
            dragging = false;
        }
    }

    dragEnd[0] = Math.min(dragEnd[0], imagePos[0] + size[0]);
    dragEnd[0] = Math.max(dragEnd[0], imagePos[0]);
    dragEnd[1] = Math.min(dragEnd[1], imagePos[1] + size[1]);
    dragEnd[1] = Math.max(dragEnd[1], imagePos[1]);

    if(dragging){
        ctx.beginPath();
        
        ctx.rect(dragStart[0], dragStart[1], dragEnd[0] - dragStart[0], dragEnd[1] - dragStart[1]);
        
        ctx.strokeStyle = "rgba(255, 187, 0, 1)"
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(255, 187, 0, 0.2)";
        
        ctx.fill();
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 187, 0, 0.6)";
        ctx.lineWidth = 2;

        ctx.moveTo(dragStart[0] < dragEnd[0] ? dragStart[0] + 1 : dragStart[0] - 1, dragStart[1] < dragEnd[1] ? dragStart[1] + 1 : dragStart[1] - 1);
        ctx.lineTo(dragStart[0] < dragEnd[0] ? dragEnd[0] - 1 : dragEnd[0] + 1, dragStart[1] < dragEnd[1] ? dragEnd[1] - 1 : dragEnd[1] + 1);

        ctx.stroke();
    }
    
}

