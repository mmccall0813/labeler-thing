let canvas = document.querySelector("canvas");
let ctx = canvas.getContext("2d");
let image = new Image();
image.onload = draw;

let mode = "idle";
let imgpos = [0, 0];
let imgsize = [0, 0];
let selectedBox;
let handle = -1;
let handles = []; // array of the positions of all current resizing handles
let tags = [];
let pendingBox;
let editingLabel = false;
let stopDrawing = true;
let sizeMultiplier = 1;
let imageOffset = [0, 0];
let actions = {
    "newlabel": {
        desc: "Create a new label and select tag",
        action: (e) => {
            if(e.target?.contentEditable === "true") return;
            if(mode === "idle") mode = "newbox";
            if(mode === "select"){
                selectedBox?.element.classList.remove("selected");
                selectedBox = null;
                mode = "newbox";
            }
        }
    },
    "newlabel2": {
        desc: "Create a new label using the tag from the previous label",
        action: (e) => {
            if(e.target?.contentEditable === "true") return;
            if(mode === "idle") mode = "newbox";
            if(mode === "select"){
                selectedBox?.element.classList.remove("selected");
                selectedBox = null;
                mode = "newbox";
            }
        }
    },
    "nextimage": {
        desc: "Next image",
        action: (e) => {
            if(mode === "idle" || mode === "select" && files.length > 1){
                selectedBox?.element.classList.remove("selected");
                selectedBox = null;
                let index = selectedFile + 1;
                if(index === files.length) index = 0;
                files[index].element.click();
            }
        }
    },
    "previmage": {
        desc: "Previous image",
        action: (e) => {
            if(mode === "idle" || mode === "select" && files.length > 1){
                selectedBox?.element.classList.remove("selected");
                selectedBox = null;
                let index = selectedFile - 1;
                if(index === -1) index = files.length - 1;
                files[index].element.click();
            }
        }
    }
};
let options = {
    showLabels: false,
    binds: {"w": "newlabel", "a": "previmage", "d": "nextimage", "e": "newlabel2"},
    lastTag: -1,
    useLastTag: false,
}
let files = [];
let selectedFile = -1; // -1: no file selected

class Tag {
    constructor(name, color){
        this.name = name || "";
        this.color = color || [];
    }
    export(){
        return {name: this.name, color: this.color};
    }
}

class Box {
    constructor() {
        this.x = 0; // x coordinate, relative to image origin
        this.y = 0; // y coordinate, relative to image origin
        this.size = {x: 0, y: 0}; // width and height of the box
        //this.color = []; // custom color, if blank, inherit from tag color
        this.tag = -1; // index of tag;
        this.highlight = false;
        this.element;
    }
    toYolo(){
        return `${this.tag} ${(this.x + this.size.x / 2) / image.naturalWidth} ${(this.y + this.size.y / 2) / image.naturalHeight} ${this.size.x / image.naturalWidth} ${this.size.y / image.naturalHeight}`;
    }
}

class FileListItem { 
    constructor(url, name, file){
        this.boxes = [];
        this.file = file;
        this.element;
        this.name = name;
        this.url = url || "";
    }
    createElement(){
        let list = document.querySelector(".fileListContent");
        let fileContainer = document.createElement("div");
        let fileContent = document.createElement("div");
        let fileDeleteButton = document.createElement("div");
        let isLabeledIcon = document.createElement("div");
        
        fileContainer.classList.add("tagContainer");
        fileContent.classList.add("tagContent", "fileContent");
        fileDeleteButton.classList.add("tagDeleteButton", "rightAlignedButton", "bi", "bi-trash3"); // bootstrap icons
        isLabeledIcon.classList.add("icon", "bi", "bi-square")
        
        fileContainer.appendChild(fileContent);
        fileContainer.appendChild(fileDeleteButton);
        fileContainer.appendChild(isLabeledIcon);
        fileContent.innerText = this.name;

        list.appendChild(fileContainer);
        this.element = fileContainer;

        fileContainer.addEventListener("click", (e) => {
            if(e.target === fileDeleteButton) return; // ignores delete button clicks

            files[selectedFile]?.element.classList.remove("selected");
            this.element.classList.add("selected");
            selectedFile = files.indexOf(this);
            rebuildLabelsList();
            if(this.url !== ""){
                image.src = this.url;
            } else { 
                let reader = new FileReader();
                reader.readAsDataURL(this.file);
                reader.onload = () => {
                    image.src = reader.result;
                    stopDrawing = false;
                    mode = "idle";
                    sizeMultiplier = 1;
                    imageOffset = [0,0];
                    draw();
                }
            }
            
        })
        fileDeleteButton.addEventListener("click", (e) => {
            let index = files.indexOf(this);
            files.splice(index, 1);
            if(files.length === 0) stopDrawing = true;
            if(selectedFile >= index) selectedFile = selectedFile - 1;
            files[selectedFile]?.element.click();
            this.element.remove();
            draw();
        })
    }
}

function saveTextFile(name, content){
    if(!name) return;
    let link = document.createElement("a");
    const file = new Blob([content], {type: "text/plain"});
    link.href = URL.createObjectURL(file);
    link.download = `${name}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
}

/* toolbar items */
function toggleLabels(icon){
    options.showLabels = !options.showLabels;

    icon.classList.remove("bi-square");
    icon.classList.remove("bi-square-fill");

    options.showLabels ? icon.classList.add("bi-square-fill") : icon.classList.add("bi-square");
    draw();
}

// dispatching a fake mouse wheel event is much easier than the alternatives
function zoomIn(){
    let fakeWheelEvent = new CustomEvent("wheel");
    fakeWheelEvent.deltaY = -1;
    cursorPos[0] = canvas.width / 2;
    cursorPos[1] = canvas.height / 2;
    canvas.dispatchEvent(fakeWheelEvent);
}
function zoomOut(){
    let fakeWheelEvent = new CustomEvent("wheel");
    fakeWheelEvent.deltaY = 1;
    cursorPos[0] = canvas.width / 2;
    cursorPos[1] = canvas.height / 2;
    canvas.dispatchEvent(fakeWheelEvent);
}
function openSingleFile(input){
    let file = input.files[0];
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        image.src = reader.result;
        let listitem = new FileListItem(reader.result, file.name, file);
        files.push(listitem);
        listitem.createElement();
        listitem.element.click();
        stopDrawing = false;
    }
}
function openMultipleFiles(input){
    let uploadedFiles = Array.from(input.files);

    uploadedFiles.forEach( (file, index) => {
        let listItem = new FileListItem("", file.name, file);

        files.push(listItem);
        listItem.createElement();
        if(index === 0) listItem.element.click();
    })
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
    if(name === undefined) edit();
    if(color?.length === 3){
        colorEditButton.style.color = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }
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
            tags.splice(tags.indexOf(tag), 1);
        }
    })
    colorEditButton.addEventListener("click", () => {colorSelector.click()});
    colorSelector.addEventListener("change", (e) => {
        colorEditButton.style.color = colorSelector.value;
        function hexToRgb(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [
              parseInt(result[1], 16),
              parseInt(result[2], 16),
              parseInt(result[3], 16)
            ] : null;
        }
        tag.color = hexToRgb(colorSelector.value);
    })
}
function saveTags(){
    let tagsToSave = [];
    tags.forEach((tag) => {tagsToSave.push(tag.export())});
    localStorage.setItem("tags", JSON.stringify(tagsToSave));
}
function loadTags(){
    let toLoad = localStorage.getItem("tags");
    if(toLoad === null) return;
    let importedTags = JSON.parse(toLoad);
    importedTags.forEach((tag) => {
        createTag(tag.name, tag.color);
    })
}

/* tag selecting */
function confirmPendingBox(){
    if(document.querySelector(".tagSelectorConfirmButton").classList.contains("disabled")) return false;
    document.querySelector(".tagSelectorConfirmButton").classList.add("disabled");

    let box = pendingBox;
    let tagList = document.querySelectorAll(".tagSelectorListItem");
    let selectedTag = -1;

    tagList.forEach((tag, index) => {
        if(tag.classList.contains("selected")) selectedTag = tag.index;
    })
    box.tag = selectedTag;

    if(editingLabel){
        mode = "idle";
        if(selectedBox) mode = "select";
        pendingBox.element.childNodes[0].innerText = tags[selectedTag].name;
        pendingBox = null;
        editingLabel = false;
        clearSelectorTagList();
        document.querySelector(".tagSelectorBackground").style.display = "none";
        draw();
        return;
    }

    files[selectedFile].boxes.push(box);
        
    rebuildLabelsList();

    mode = "idle";
    pendingBox = null;
    clearSelectorTagList();
    document.querySelector(".tagSelectorBackground").style.display = "none";

    draw();
}

function cancelPendingBox(){
    mode = "idle";
    pendingBox = null;
    clearSelectorTagList();
    document.querySelector(".tagSelectorBackground").style.display = "none";

    draw();
}

function clearSelectorTagList(){
    let list = document.querySelectorAll(".tagSelectorListItem");

    list.forEach((a) => {a.remove()});
}

function searchSelectorTagList(input){
    let found = false;
    let list = document.querySelectorAll(".tagSelectorListItem");

    list.forEach( (listItem) => {
        if(found) return;
        if(listItem.innerText.includes(input.value)){
            found = true;
            list.forEach( (a) => {a.classList.remove("selected")});
            listItem.classList.add("selected");
            listItem.scrollIntoView();
        }
    });
    document.querySelector(".tagSelectorConfirmButton").classList.remove("disabled");
    if(!found) {
        document.querySelector(".tagSelectorConfirmButton").classList.add("disabled");
        list.forEach( (a) => {a.classList.remove("selected")});
    }
}

function createSelectorTagList(){
    let list = document.querySelector(".tagSelectorList");

    tags.forEach( (tag, index) => {
        let tagListItem = document.createElement("div");
        tagListItem.classList.add("tagSelectorListItem");
        tagListItem.index = index;
        tagListItem.innerText = tag.name;
        tagListItem.addEventListener("click", () => {
            let items = document.querySelectorAll(".tagSelectorListItem");
            items.forEach((a) => {a.classList.remove("selected")});
            tagListItem.classList.add("selected");
            document.querySelector(".tagSelectorConfirmButton").classList.remove("disabled");
            tagListItem.scrollIntoView();
        })
        list.appendChild(tagListItem);
    })
}

function rebuildLabelsList(){
    // html stuff
    let list = document.querySelector(".labelListContent");
    
    list.childNodes.forEach((a) => {a.remove()});

    files[selectedFile].boxes.forEach( (box) => {
        let labelContainer = document.createElement("div");
        let labelContent = document.createElement("div");
        let labelDeleteButton = document.createElement("div");
        let labelEditTagButton = document.createElement("div");

        labelContainer.classList.add("tagContainer");
        labelContent.classList.add("tagContent");
        labelDeleteButton.classList.add("tagDeleteButton", "rightAlignedButton", "bi", "bi-trash3");
        labelEditTagButton.classList.add("rightAlignedButton", "bi", "bi-pencil-square");

        labelContainer.appendChild(labelContent);
        labelContainer.appendChild(labelDeleteButton);
        labelContainer.appendChild(labelEditTagButton);

        labelContent.innerText = tags[box.tag]?.name || "[no tag]"
        box.element = labelContainer;
        labelContainer.box = box;

        labelContainer.addEventListener("mouseenter", () => {
            box.highlight = true;
            draw();
        });
        labelContainer.addEventListener("mouseleave", () => {
            box.highlight = false;
            draw();
        });
        labelContainer.addEventListener("click", () => {
            selectedBox?.element.classList.remove("selected"); // remove selected from previous selected box
            selectedBox = box;
            mode="select";
            selectedBox.element.classList.add("selected");
            selectedBox.element.scrollIntoView()
            draw();
        })
        labelDeleteButton.addEventListener("click", () => {
            files[selectedFile].boxes.splice(files[selectedFile].boxes.indexOf(box), 1);
            if(selectedBox === box){
                selectedBox.element.classList.remove("selected");
                selectedBox = null;
                mode = "idle";
                handle = -1;
            }
            list.removeChild(labelContainer);
            rebuildLabelsList();
            draw();
        });
        labelEditTagButton.addEventListener("click", () => {
            pendingBox = box;
            editingLabel = true;
            document.querySelector(".tagSelectorBackground").style.display = "block";
            let searchInput = document.querySelector(".tagSelectorSearch")
            searchInput.focus({focusVisible:false});
            searchInput.value = "";
            createSelectorTagList();
            mode = "pendingbox";
        })

        list.appendChild(labelContainer);
    });

    let icon = files[selectedFile].element.querySelector(".icon");
    if(files[selectedFile].boxes.length > 0){
        icon.classList.remove("bi-square");
        icon.classList.add("bi-check-square-fill");
    } else {
        icon.classList.remove("bi-check-square-fill");
        icon.classList.add("bi-square");
    }
}

document.querySelector(".tagSelectorSearch").addEventListener("keydown", (e) => {
    switch(e.key){
        case "Enter": 
            e.preventDefault();
            confirmPendingBox();
        break;
        case "Escape":
            e.preventDefault();
            cancelPendingBox();
        break;
    }
    
});

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
let draggingMouse2 = false;

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
    if(stopDrawing) return; // prevents errors
    let pos = getMousePos(canvas, e);
    if(e.button === 0 && mode === "newbox"){
        dragging = true;
        dragStart = [pos.x, pos.y];
    }
    if(e.button === 0 && (mode === "idle" || mode === "select") && handle === -1){
        let found = false; // has it already found a box to highlight?
        for(var i = 0; i < files[selectedFile].boxes.length; i++){
            if(found) break;
            var box = files[selectedFile].boxes[i];
            if(isWithinBounds(canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]), {x: box.x, y: box.y}, {x: box.size.x, y: box.size.y})){
                found = true;
                selectedBox?.element.classList.remove("selected");
                selectedBox = box;
                mode = "select";
                dragging = true;
                box.element.classList.add("selected");
                box.element.scrollIntoView();
                let imageMousePos = canvasPosToUnscaledPos(pos.x, pos.y);
                let boxMousePos = {x: imageMousePos.x - box.x, y: imageMousePos.y - box.y};
                dragStart = [boxMousePos.x, boxMousePos.y]; // grab point
            }
        }
        if(!found){
            mode = "idle";
            selectedBox?.element.classList.remove("selected");
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
    if(e.button === 2){
        draggingMouse2 = true;
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
    if(draggingMouse2){
        imageOffset[0] += e.movementX;
        imageOffset[1] += e.movementY;
    }
    draw();
});
window.addEventListener("mouseup", (e) => {
    if(e.button === 2) draggingMouse2 = false;
    if(e.button !== 0) return;
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

        document.querySelector(".tagSelectorBackground").style.display = "block";
        let searchInput = document.querySelector(".tagSelectorSearch")
        searchInput.focus({focusVisible:false});
        searchInput.value = "";
        createSelectorTagList();

        pendingBox = box;
        mode = "pendingbox";
    }
    if(dragging){
        dragging = false;
        dragStart = [-1, -1];
        dragEnd = [-1,-1];
        handle = -1;
    }
    if(mode !== "pendingbox") draw();
});

window.addEventListener("keydown", (e) => {
    switch(e.key){
        case "Escape":
            if(mode === "select"){
                selectedBox?.element.classList.remove("selected");
                selectedBox = null;
            }
            if(mode === "pendingbox") break;
            dragging = false;
            mode = "idle";
            draw();
        break;
        default: 
            actions[options.binds[e.key]]?.action(e);
        break;
    }
    if(mode !== "pendingbox") draw();
})

canvas.addEventListener("wheel", (e) => {
    let oldZoom = sizeMultiplier+0;
    if(e.deltaY < 0){
        sizeMultiplier*=1.1;
    }
    if(e.deltaY > 0){
        sizeMultiplier*=0.9;
    }

    sizeMultiplier = Math.max(1, sizeMultiplier);
    sizeMultiplier = Math.min(10, sizeMultiplier);

    let oldHoverPos = canvasPosToUnscaledPos(cursorPos[0], cursorPos[1]);

    if(sizeMultiplier !== oldZoom){
        let fac = (sizeMultiplier / oldZoom)
        imageOffset[0]*=fac;
        imageOffset[1]*=fac;
    }
    draw(); // update imagePos

    let oldHoverGlobalPos = imageToGlobal(oldHoverPos.x, oldHoverPos.y);
    let difference = [cursorPos[0] - oldHoverGlobalPos.x, cursorPos[1] - oldHoverGlobalPos.y];

    imageOffset[0] += difference[0];
    imageOffset[1] += difference[1];

    draw();
})

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(stopDrawing) return; // used when drawing could result in errors
    
    let maxHeight = canvas.height - 50;
    let maxWidth = canvas.width - 50;
    let ratio = image.naturalWidth / image.naturalHeight;
    let size = [image.naturalWidth, image.naturalHeight];
    canvas.style.cursor = "auto";

    // try height scaling, then try width scaling
    if(size[0] > maxHeight){
        size[0] = Math.floor(maxHeight * ratio);
        size[1] = maxHeight;
    }
    if(size[1] > maxWidth){
        size[0] = maxWidth;
        size[1] = Math.floor(maxWidth / ratio);
    }
    size[0] *= sizeMultiplier;
    size[1] *= sizeMultiplier;
    let imagePos = [(canvas.width / 2 - size[0] / 2) + imageOffset[0], (canvas.height / 2 - size[1] / 2) + imageOffset[1]];
    
    // make the variables accessible outside of the draw func
    imgpos = imagePos;
    imgsize = size;
    
    ctx.drawImage(image, imagePos[0], imagePos[1], size[0], size[1])
    
    // highlight box your mouse is over
    if(mode === "idle" || mode === "select" && !dragging){
        let found = false; // has it already found a box to highlight?
        for(var i = 0; i < files[selectedFile].boxes.length; i++){
            if(found) break;
            var box = files[selectedFile].boxes[i];
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
    files[selectedFile].boxes.forEach( (box) => {
        ctx.beginPath();
        let boxColor = [];
        if(tags.length > 0 && box.tag !== -1){
            try {
                boxColor = tags[box.tag].color; 
            } catch(err){
                boxColor = [];
            }
        }
        ctx.strokeStyle = boxColor.length === 3 ? `rgba(${boxColor[0]}, ${boxColor[1]}, ${boxColor[2]}, 0.9)` : "rgba(255, 187, 0, 0.9)";
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
        // draw label, if option is enabled
        if(options.showLabels){
            ctx.beginPath();
            let label = tags[box.tag].name
            ctx.font = '12px monospace';
            ctx.fillStyle = boxColor.length === 3 ? `rgba(${boxColor[0]}, ${boxColor[1]}, ${boxColor[2]}, 0.9)` : "rgba(255, 187, 0, 0.9)";
            ctx.rect(pos.x, pos.y - 16, (label.length * 7) + 4, 16);
            ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.fillText(label, pos.x + 2, pos.y - 2);
            ctx.closePath();
        }

        ctx.rect(pos.x, pos.y, (box.size.x * (size[0] / image.naturalWidth)), (box.size.y * (size[1] / image.naturalHeight)));
        ctx.stroke();


        if((selectedBox === box) && !(box.highlight || (mode === "select" && (dragging || handle !== -1)))){
            ctx.fillStyle = boxColor.length === 3 ? `rgba(${boxColor[0]}, ${boxColor[1]}, ${boxColor[2]}, 0.25)` : "rgba(255, 187, 0, 0.25)";
            ctx.fill();
        } else if((box.highlight || (mode === "select" && (dragging || handle !== -1))) && selectedBox === box){
            if((mode === "select" && handle === -1)){
                canvas.style.cursor = "grab";
                if(dragging) canvas.style.cursor = "grabbing";
            }
            box.highlight = false;
            ctx.fillStyle = boxColor.length === 3 ? `rgba(${boxColor[0]}, ${boxColor[1]}, ${boxColor[2]}, 0.3)` : "rgba(255, 187, 0, 0.3)";
            ctx.fill();
        } else if(box.highlight){
            canvas.style.cursor = "pointer";
            box.highlight = false;
            ctx.fillStyle = boxColor.length === 3 ? `rgba(${boxColor[0]}, ${boxColor[1]}, ${boxColor[2]}, 0.3)` : "rgba(255, 187, 0, 0.2)";
            ctx.fill();
        }

        if((selectedBox === box)){
            // draw resize handles, and add their positions to an array
            handles = [];

            // coloring
            ctx.strokeStyle = "rgba(48, 255, 48, 1)";
            ctx.lineWidth = 1
            ctx.fillStyle = "rgba(48, 128, 48, 1)";

            // north west
            ctx.beginPath();
            let nwpos = imageToGlobal(box.x, box.y); 
            ctx.arc(nwpos.x, nwpos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([nwpos.x, nwpos.y])

            // north
            ctx.beginPath();
            let npos = imageToGlobal(box.x + (box.size.x / 2), box.y); 
            ctx.arc(npos.x, npos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([npos.x, npos.y])

            // north east
            ctx.beginPath();
            let nepos = imageToGlobal(box.x + box.size.x, box.y); 
            ctx.arc(nepos.x, nepos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([nepos.x, nepos.y])

            // east
            ctx.beginPath();
            let epos = imageToGlobal(box.x + box.size.x, box.y + box.size.y / 2)
            ctx.arc(epos.x, epos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([epos.x, epos.y])

            // south east
            ctx.beginPath();
            let sepos = imageToGlobal(box.x + box.size.x, box.y + box.size.y)
            ctx.arc(sepos.x, sepos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([sepos.x, sepos.y])

            // south
            ctx.beginPath();
            let spos = imageToGlobal(box.x + box.size.x / 2, box.y + box.size.y)
            ctx.arc(spos.x, spos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([spos.x, spos.y])

            // south west
            ctx.beginPath();
            let swpos = imageToGlobal(box.x, box.y + box.size.y)
            ctx.arc(swpos.x, swpos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            handles.push([swpos.x, swpos.y])

            // west
            ctx.beginPath();
            let wpos = imageToGlobal(box.x, box.y + box.size.y / 2);
            ctx.arc(wpos.x, wpos.y, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
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