let canvas = document.querySelector("canvas");
let ctx = canvas.getContext("2d");
let image = new Image();
image.src = "42271.png";

image.onload = draw;

let mode = "idle";
let boxes = [];
let imgpos;
let imgsize;
let selectedBox;
let handle = "none";

class Tag {
    constructor(name, color){
        this.name = name || "";
        this.color = "";
    }
}

class Box {
    constructor() {
        this.x = 0; // x coordinate, relative to image origin
        this.y = 0; // y coordinate, relative to image origin
        this.size = {x: 0, y: 0}; // width and height of the box
        this.color = ""; // custom color, if blank, inherit from tag color
        this.tag = -1; // index of tag;
        this.highlight = false;
    }
    toYolo(){
        return `${this.tag} ${this.x} ${this.y} ${this.size.x} ${this.size.y}`;
    }
}

// helper function
// returns true if the given coords are in the bounds given
function isWithinBounds(toTest, pos, size){
    return (toTest.x >= pos.x && toTest.x <= pos.x + size.x && toTest.y >= pos.y && toTest.y <= pos.y + size.y);
}
// takes unscaled image coordinates and returns where that point is on the canvas
function imageToGlobal(x, y){
    return {x: (imgpos[0] + (x * (imgsize[0] / image.naturalWidth))), y: (imgpos[1] + (y * (imgsize[1] / image.naturalHeight)))};
}
// takes a point on the canvas and returns where that is on the unscaled image
function canvasPosToUnscaledPos(x, y){
    return {x: (x-imgpos[0]) / (imgsize[0] / image.naturalWidth), y: (y-imgpos[1]) / (imgsize[1] / image.naturalHeight)}
};

let cursorPos = [0, 0];
let dragStart = [-1, -1];
let dragEnd = [-1, -1];
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
    let pos = getMousePos(canvas, e);
    if(e.button === 0 && mode === "newbox"){
        dragging = true;
        dragStart = [pos.x, pos.y];
    }
    if(e.button === 0 && (mode === "idle" || mode === "select")){
        let found = false; // has it already found a box to highlight?
        for(var i = 0; i < boxes.length; i++){
            if(found) break;
            var box = boxes[i];
            if(isWithinBounds(canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]), {x: box.x, y: box.y}, {x: box.size.x, y: box.size.y})){
                found = true;
                selectedBox = box;
                mode = "select";
                dragging = true;
                let imageMousePos = canvasPosToUnscaledPos(pos.x, pos.y);
                let boxMousePos = {x: imageMousePos.x - box.x, y: imageMousePos.y - box.y};
                dragStart = [boxMousePos.x, boxMousePos.y]; // grab point
            }
        }
        if(!found){
            mode = "idle";
            selectedBox = null;
        }
        draw();
    }
});
canvas.addEventListener("mousemove", (e) => {
    let pos = getMousePos(canvas, e);
    cursorPos = [pos.x, pos.y];
    if(dragging){
        dragEnd = cursorPos;
    }
    draw();
});
window.addEventListener("mouseup", (e) => {
    if(e.button != 0) return;
    if(dragging && mode === "newbox"){
        dragging = false

        let start = canvasPosToUnscaledPos(dragStart[0], dragStart[1]);
        let end= canvasPosToUnscaledPos(dragEnd[0], dragEnd[1]);

        // do some swapping if needed to make sure that start is the top left and end is the bottom right
        let hold;
        if(end.x < start.x){
            hold = start.x;
            start.x = end.x;
            end.x = hold;
        }
        if(end.y < start.y){
            hold = start.y;
            start.y = end.y;
            end.y = hold;
        }

        // round the numbers a little
        function roundToFixed(num, places){
            return Math.round(num.toFixed(places) * (10 ** places)) / (10 ** places);
        }
        start.x = roundToFixed(start.x, 2);
        start.y = roundToFixed(start.y, 2);
        end.x = roundToFixed(end.x, 2);
        end.y = roundToFixed(end.y, 2);

        let boxsize = [end.x - start.x, end.y - start.y];
        let box = new Box();
        box.x = start.x;
        box.y = start.y;
        box.size.x = boxsize[0];
        box.size.y = boxsize[1];
        boxes.push(box);
        mode = "idle";
    }
    if(dragging){
        dragging = false;
        dragStart = [-1, -1];
        dragEnd = [-1,-1]
    }
    draw();
});

window.addEventListener("keydown", (e) => {
    switch(e.key){
        case "Escape":
            if(mode === "select"){
                selectedBox = null;
            }
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
    canvas.style.cursor = "auto";

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
    
    // make the variables accessible outside of the draw func
    imgpos = imagePos;
    imgsize = size;
    
    
    ctx.drawImage(image, imagePos[0], imagePos[1], size[0], size[1])
    
    // highlight box your mouse is over
    if(mode === "idle" || mode === "select"){
        let found = false; // has it already found a box to highlight?
        for(var i = 0; i < boxes.length; i++){
            if(found) break;
            var box = boxes[i];
            if(isWithinBounds(canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]), {x: box.x, y: box.y}, {x: box.size.x, y: box.size.y})){
                found = true;
                box.highlight = true;
            }
        }
    }
    if(mode === "select" && dragging && handle === "none"){
        let imageMousePos = canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]);
        selectedBox.x = imageMousePos.x - dragStart[0];
        selectedBox.y = imageMousePos.y - dragStart[1];

        selectedBox.x = Math.min(selectedBox.x, image.naturalWidth - selectedBox.size.x);
        selectedBox.x = Math.max(selectedBox.x, 0);
        selectedBox.y = Math.min(selectedBox.y, image.naturalHeight - selectedBox.size.y);
        selectedBox.y = Math.max(selectedBox.y, 0);
    }

    // draw boxes
    boxes.forEach( (box) => {
        ctx.beginPath();
        ctx.strokeStyle = box.color || "rgba(255, 187, 0, 0.9)";
        ctx.lineWidth = 1;
        let pos = imageToGlobal(box.x, box.y);
        ctx.rect(pos.x, pos.y, (box.size.x * (size[0] / image.naturalWidth)), (box.size.y * (size[1] / image.naturalHeight)));
        ctx.stroke();
        if((selectedBox === box) && !box.highlight){
            ctx.fillStyle = "rgba(255, 187, 0, 0.25)";
            ctx.fill();
        } else if(box.highlight && selectedBox === box){
            canvas.style.cursor = "grab";
            if(dragging) canvas.style.cursor = "grabbing";
            box.highlight = false;
            ctx.fillStyle = "rgba(255, 187, 0, 0.3)";
            ctx.fill();
        } else if(box.highlight){
            canvas.style.cursor = "pointer";
            box.highlight = false;
            ctx.fillStyle = "rgba(255, 187, 0, 0.2)";
            ctx.fill();
        }

        if((selectedBox === box)){
            // draw resize handles, and detect hovering

            // north west
            ctx.beginPath();
            let nwpos = imageToGlobal(box.x, box.y); 
            ctx.arc(nwpos.x, nwpos.y, 3, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(48, 255, 48, 1)";
            ctx.lineWidth = 3
            ctx.fillStyle = "rgba(48, 128, 48, 1)";
            ctx.stroke();
            ctx.fill();

            // north
            ctx.beginPath();
            let npos = imageToGlobal(box.x + (box.size.x / 2), box.y); 
            ctx.arc(npos.x, npos.y, 3, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(48, 255, 48, 1)";
            ctx.lineWidth = 3
            ctx.fillStyle = "rgba(48, 128, 48, 1)";
            ctx.stroke();
            ctx.fill();

            // north east
            ctx.beginPath();
            let nepos = imageToGlobal(box.x + box.size.x, box.y); 
            ctx.arc(nepos.x, nepos.y, 3, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(48, 255, 48, 1)";
            ctx.lineWidth = 3
            ctx.fillStyle = "rgba(48, 128, 48, 1)";
            ctx.stroke();
            ctx.fill();
        }
    })

    if(mode === "newbox" && !dragging){
        // is cursor in bounds of the image?
        if((cursorPos[0] >= imagePos[0] && (cursorPos[0] <= imagePos[0] + size[0])) && (cursorPos[1] >= imagePos[1] && (cursorPos[1] <= imagePos[1] + size[1]))){
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#000000"
            ctx.beginPath();
            ctx.moveTo(cursorPos[0] + 0.5, Math.floor(imagePos[1]) + 0.5);
            ctx.lineTo(cursorPos[0], Math.floor(imagePos[1] + size[1]));
            ctx.moveTo(Math.floor(imagePos[0]) + 0.5, Math.floor(cursorPos[1]) + 0.5);
            ctx.lineTo(Math.floor(imagePos[0] + size[0]), cursorPos[1]);
            ctx.closePath();
            ctx.stroke();
            canvas.style.cursor = "none";
        }
    }

    // verify that a drag has started INSIDE the image, if not, disable dragging varible
    if(dragging && mode === "newbox"){
        if(!isWithinBounds({x: dragStart[0], y: dragStart[1]}, {x:imagePos[0], y:imagePos[1]}, {x:size[0], y:size[1]})){
            dragging = false;
        }
    }

    dragEnd[0] = Math.min(dragEnd[0], imagePos[0] + size[0]);
    dragEnd[0] = Math.max(dragEnd[0], imagePos[0]);
    dragEnd[1] = Math.min(dragEnd[1], imagePos[1] + size[1]);
    dragEnd[1] = Math.max(dragEnd[1], imagePos[1]);

    if(dragging && mode === "newbox"){
        ctx.beginPath();
        
        ctx.rect(dragStart[0], dragStart[1], dragEnd[0] - dragStart[0], dragEnd[1] - dragStart[1]);
        
        ctx.strokeStyle = "rgba(255, 187, 0, 0.6)"
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(255, 187, 0, 0.1)";
        
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