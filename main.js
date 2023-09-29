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
let handle = -1;
let handles = []; // array of the positions of all current resizing handles
let tags = [];

class Tag {
    constructor(name, color){
        this.name = name || "";
        this.color = color || [];
    }
}

class Box {
    constructor() {
        this.x = 0; // x coordinate, relative to image origin
        this.y = 0; // y coordinate, relative to image origin
        this.size = {x: 0, y: 0}; // width and height of the box
        this.color = []; // custom color, if blank, inherit from tag color
        this.tag = -1; // index of tag;
        this.highlight = false;
    }
    toYolo(){
        return `${this.tag} ${this.x} ${this.y} ${this.size.x} ${this.size.y}`;
    }
}

/* tags */
function createTag(name, color){
    let list = document.querySelector(".tagsListContent");
    let tagContainer = document.createElement("div");
    let tagContent = document.createElement("div");
    let tagDeleteButton = document.createElement("div");
    let tagEditButton = document.createElement("div");
    let colorEditButton = document.createElement("div");
    let colorSelector = document.createElement("input");
    
    tagContainer.classList.add("tagContainer");
    tagContent.classList.add("tagContent");
    tagDeleteButton.classList.add("tagDeleteButton", "rightAlignedButton", "bi", "bi-trash3"); // bootstrap icons
    tagEditButton.classList.add("tagEditButton", "rightAlignedButton", "bi", "bi-pencil-square");
    colorEditButton.classList.add("colorEditIcon", "bi", "bi-droplet-half", "rightAlignedButton");
    colorSelector.classList.add("colorEditInput");
    colorSelector.type = "color";

    tagContainer.appendChild(tagContent);
    tagContainer.appendChild(tagDeleteButton);
    tagContainer.appendChild(tagEditButton);
    colorEditButton.appendChild(colorSelector);
    tagContainer.appendChild(colorEditButton);

    list.appendChild(tagContainer);

    let tag = new Tag(name || `tag${tags.length+1}`, color || undefined);

    tags.push(tag);
    tagContent.innerText = tag.name;
    function edit(){
        tagContent.contentEditable = true;
        tagContent.focus();
        window.getSelection().selectAllChildren(tagContent);
    }
    edit();
    tagContent.addEventListener("focusout", () => {
        tagContent.contentEditable = false;
        window.getSelection().empty();
        tagContent.innerText = tagContent.innerText.trim();
        if(tagContent.innerText === "") tagContent.innerText = `tag${tags.indexOf(tag)+1}`;
        tag.name = tagContent.innerText;
    });
    tagContent.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === "Escape"){
            e.preventDefault();
            tagContent.contentEditable = false;
            window.getSelection().empty();
            tagContent.innerText = tagContent.innerText.trim();
            if(tagContent.innerText === "") tagContent.innerText = `tag${tags.indexOf(tag)+1}`;
            tag.name = tagContent.innerText;
            tagContent.blur(); // removes the focus outline
        }
    });
    tagEditButton.addEventListener("click", edit);
    tagDeleteButton.addEventListener("click", () => {
        if(window.confirm("Warning! Deleting tags will very likely break all of your existing labels! Only do this if you made this tag by accident or if it's unused AND last in the list.")){
            list.removeChild(tagContainer);
            tags.splice(tags.indexOf(tag));
        }
    })
    colorEditButton.addEventListener("click", () => {colorSelector.click()});
    colorSelector.addEventListener("change", (e) => {
        console.log(colorSelector.value);
        colorEditButton.style.color = colorSelector.value;
    })
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
    if(e.button === 0 && (mode === "idle" || mode === "select") && handle === -1){
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
    if(e.button === 0 && (mode === "select") && handle !== -1){
        dragging = true;
        switch(handle){
            case 0: // nw
                dragStart = [selectedBox.x + selectedBox.size.x, selectedBox.y + selectedBox.size.y];
            break;
            case 1: // n
                dragStart = [0 /* unused */, selectedBox.y + selectedBox.size.y];
            break;
            case 2: // ne
                dragStart = [0 /* unused */, selectedBox.y + selectedBox.size.y];
            break;
            case 3: // e
                // unused
            break;
            case 4: // se
                // unused
            break;
            case 5: // s
                // unused
            break;
            case 6: // sw
                dragStart = [selectedBox.x + selectedBox.size.x, 0 /* unused */];
            break;
            case 7: // w
                dragStart = [selectedBox.x + selectedBox.size.x, 0 /* unused */];
            break;
        }
    }
});
canvas.addEventListener("mousemove", (e) => {
    let pos = getMousePos(canvas, e);
    cursorPos = [pos.x, pos.y];
    if(dragging){
        dragEnd = cursorPos;
    } else if(mode === "select"){
        // check if the cursor is over any handles
        let handleSize = [6, 6];
        let found = false;
        handles.forEach( (h, i) => {
            if(found) return; // already found, no need to do more checks
            let handlePos = {x: h[0] - (handleSize[0] / 2), y: h[1] - (handleSize[1] / 2)};
            if(isWithinBounds(pos, handlePos, {x: handleSize[0], y: handleSize[0]})){
                found = true;
                handle = i;
            }
        })
        if(!found) handle = -1;
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
        dragEnd = [-1,-1];
        handle = -1;
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
            if (mode === "select"){
                selectedBox = null;
                mode = "newbox";
            }
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
    if(mode === "select" && dragging && handle === -1){
        let imageMousePos = canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]);
        selectedBox.x = imageMousePos.x - dragStart[0];
        selectedBox.y = imageMousePos.y - dragStart[1];

        selectedBox.x = Math.min(selectedBox.x, image.naturalWidth - selectedBox.size.x);
        selectedBox.x = Math.max(selectedBox.x, 0);
        selectedBox.y = Math.min(selectedBox.y, image.naturalHeight - selectedBox.size.y);
        selectedBox.y = Math.max(selectedBox.y, 0);
    }
    if(mode === "select" && handle !== -1){
        let cur = "auto";
        switch(handle){
            case 0: // nw
                cur = "nwse-resize";
                if((selectedBox.size.x < 0 || selectedBox.size.y < 0) && !(selectedBox.size.x < 0 && selectedBox.size.y < 0)) cur = "nesw-resize";
            break;
            case 1: // n
                cur = "ns-resize";
            break;
            case 2: // ne
                cur = "nesw-resize";
                if((selectedBox.size.x < 0 || selectedBox.size.y < 0) && !(selectedBox.size.x < 0 && selectedBox.size.y < 0)) cur = "nwse-resize";
            break;
            case 3: // e
                cur = "ew-resize";
            break;
            case 4: // se
                cur = "nwse-resize";
                if((selectedBox.size.x < 0 || selectedBox.size.y < 0) && !(selectedBox.size.x < 0 && selectedBox.size.y < 0)) cur = "nesw-resize";
            break;
            case 5: // s
                cur = "ns-resize";
            break;
            case 6: // sw
                cur = "nesw-resize";
                if((selectedBox.size.x < 0 || selectedBox.size.y < 0) && !(selectedBox.size.x < 0 && selectedBox.size.y < 0)) cur = "nwse-resize";
            break;
            case 7: // w
                cur = "ew-resize";
            break;
        }
        canvas.style.cursor = cur;
        if(dragging){
            let imgCurPos = canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]);

            // clamp cursor pos, prevents oversizing boxes to be outside image
            imgCurPos.x = Math.min(imgCurPos.x, image.naturalWidth);
            imgCurPos.x = Math.max(imgCurPos.x, 0);
            imgCurPos.y = Math.min(imgCurPos.y, image.naturalHeight);
            imgCurPos.y = Math.max(imgCurPos.y, 0);

            switch(handle){
                case 0: // nw
                    selectedBox.size.x = (dragStart[0] - imgCurPos.x);
                    selectedBox.x = imgCurPos.x;
                    selectedBox.size.y = (dragStart[1] - imgCurPos.y);
                    selectedBox.y = imgCurPos.y;
                break;
                case 1: // n
                    selectedBox.size.y = (dragStart[1] - imgCurPos.y);
                    selectedBox.y = imgCurPos.y;
                break;
                case 2: // ne
                    selectedBox.size.x = (imgCurPos.x - selectedBox.x);
                    selectedBox.size.y = (dragStart[1] - imgCurPos.y);
                    selectedBox.y = imgCurPos.y;
                break;
                case 3: // e
                    selectedBox.size.x = (imgCurPos.x - selectedBox.x);
                break;
                case 4: // se
                    selectedBox.size.x = (imgCurPos.x - selectedBox.x);
                    selectedBox.size.y = (imgCurPos.y - selectedBox.y);
                break;
                case 5: // s
                    selectedBox.size.y = (imgCurPos.y - selectedBox.y);
                break;
                case 6: // sw
                    selectedBox.size.y = (imgCurPos.y - selectedBox.y);
                    selectedBox.size.x = (dragStart[0] - imgCurPos.x);
                    selectedBox.x = imgCurPos.x;
                break;
                case 7: // w
                    selectedBox.size.x = (dragStart[0] - imgCurPos.x);
                    selectedBox.x = imgCurPos.x;
                break;
            }
        }
    }

    // draw boxes
    boxes.forEach( (box) => {
        ctx.beginPath();
        ctx.strokeStyle = box.color.length === 3 ? `rgba(${box.color[0]}, ${box.color[1]}, ${box.color[2]}, 0.9)` : "rgba(255, 187, 0, 0.9)";
        ctx.lineWidth = 1;
        if(!(mode === "select" && dragging) && (box.size.x < 0 || box.size.y < 0)){
            if(box.size.x < 0){    
                box.x = box.x + box.size.x;
                box.size.x = box.size.x * -1;
            }
            if(box.size.y < 0){
                box.y = box.y + box.size.y;
                box.size.y = box.size.y * -1;
            }
        }
        let pos = imageToGlobal(box.x, box.y);
        ctx.rect(pos.x, pos.y, (box.size.x * (size[0] / image.naturalWidth)), (box.size.y * (size[1] / image.naturalHeight)));
        ctx.stroke();
        if((selectedBox === box) && !(box.highlight || (mode === "select" && handle !== -1))){
            ctx.fillStyle = box.color.length === 3 ? `rgba(${box.color[0]}, ${box.color[1]}, ${box.color[2]}, 0.25)` : "rgba(255, 187, 0, 0.25)";
            ctx.fill();
        } else if((box.highlight || (mode === "select" && handle !== -1)) && selectedBox === box){
            if(!(mode === "select" && handle !== -1)){
                canvas.style.cursor = "grab";
                if(dragging) canvas.style.cursor = "grabbing";
            }
            box.highlight = false;
            ctx.fillStyle = box.color.length === 3 ? `rgba(${box.color[0]}, ${box.color[1]}, ${box.color[2]}, 0.3)` : "rgba(255, 187, 0, 0.3)";
            ctx.fill();
        } else if(box.highlight){
            canvas.style.cursor = "pointer";
            box.highlight = false;
            ctx.fillStyle = "rgba(255, 187, 0, 0.2)";
            ctx.fill();
        }

        if((selectedBox === box)){
            // draw resize handles, and add their positions to an array
            handles = [];

            // coloring
            ctx.strokeStyle = box.color.length === 3 ? `rgba(${box.color[0]}, ${box.color[1]}, ${box.color[2]}, 1)` : "rgba(48, 255, 48, 1)";
            ctx.lineWidth = 3
            ctx.fillStyle = box.color.length === 3 ? `rgba(${box.color[0]}, ${box.color[1]}, ${box.color[2]}, 1)` : "rgba(48, 128, 48, 1)";

            // north west
            ctx.beginPath();
            let nwpos = imageToGlobal(box.x, box.y); 
            ctx.arc(nwpos.x, nwpos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([nwpos.x, nwpos.y])

            // north
            ctx.beginPath();
            let npos = imageToGlobal(box.x + (box.size.x / 2), box.y); 
            ctx.arc(npos.x, npos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([npos.x, npos.y])

            // north east
            ctx.beginPath();
            let nepos = imageToGlobal(box.x + box.size.x, box.y); 
            ctx.arc(nepos.x, nepos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([nepos.x, nepos.y])

            // east
            ctx.beginPath();
            let epos = imageToGlobal(box.x + box.size.x, box.y + box.size.y / 2)
            ctx.arc(epos.x, epos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([epos.x, epos.y])

            // south east
            ctx.beginPath();
            let sepos = imageToGlobal(box.x + box.size.x, box.y + box.size.y)
            ctx.arc(sepos.x, sepos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([sepos.x, sepos.y])

            // south
            ctx.beginPath();
            let spos = imageToGlobal(box.x + box.size.x / 2, box.y + box.size.y)
            ctx.arc(spos.x, spos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([spos.x, spos.y])

            // south west
            ctx.beginPath();
            let swpos = imageToGlobal(box.x, box.y + box.size.y)
            ctx.arc(swpos.x, swpos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([swpos.x, swpos.y])

            // west
            ctx.beginPath();
            let wpos = imageToGlobal(box.x, box.y + box.size.y / 2);
            ctx.arc(wpos.x, wpos.y, 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
            handles.push([wpos.x, wpos.y])
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