const visuals = {
    textSize: 30,
    strokeWeight: 3,
    roundness: 4,

    node: {
        size: 13,
        spacing: 26
    },

    colors: {
        on: "rgb(242, 4, 4)",
        off: "rgb(57, 2, 2)",
        keys: {
            on: "#acacac",
            off: "#484848"
        }
    }
}
const settings = {
    snapGrid: 20
}
const camera = {
    pos: {
        x: 0,
        y: 0
    },

    zoom: 1,
    
    limits: {
        min: 0.4,
        max: 10
    },
    
    smoothing: {
        zoomTarget: 1,
        threshold: 0.005,
        smoothing: 5
    },

    zoomFactor: 1.15
}

const debug = {
    camera: false,
    // collisions: false,
    gates: false,
    // connections: false,
    mouse: false,
    fps: false,
    // grid: false
}

let dynamicGates = []

let message = ""

let resetTimer = 0

let gateList = new Map()
let connectionsList = new Map()

let font;
function preload(){
    font = loadFont("assets/CascadiaCode.ttf");
}

// html elements
let canvas;
let buttons = []
let deleteButton;
let banner;

function setup(){
    textFont(font)
    textSize(visuals.textSize)
    
    canvas = createCanvas(windowWidth, windowHeight)
    canvas.elt.addEventListener('contextmenu', e => e.preventDefault())

    centerCanvas()
    setupButtons()
    setupUserExperience()
}
function setupUserExperience(){
    if(getItem("dataCollectAccepted") == null){
        newMessage("Welcome! Let's explore digital logic together.")
        banner.classList.add("show");
    }else{
        const lastSketch = getItem("sketch")
        if(lastSketch != null){
            const succes = loadSketch(lastSketch)
            if(succes){
                newMessage("Sketch restored!")
            }else{
                newMessage("Welcome again!")
            }
        }
    }
    
}
function setupButtons(){
    buttons.push(createButton("INPUT"))
    buttons.push(createButton("AND"))
    buttons.push(createButton("OR"))
    buttons.push(createButton("NOT"))
    buttons.push(createButton("LED"))
    buttons[0].parent("menu")
    buttons[1].parent("menu")
    buttons[2].parent("menu")
    buttons[3].parent("menu")
    buttons[4].parent("menu")
    buttons[0].mousePressed(() => {quick.create("#A")})
    buttons[1].mousePressed(() => {quick.create("AND")})
    buttons[2].mousePressed(() => {quick.create("OR")})
    buttons[3].mousePressed(() => {quick.create("NOT")})
    buttons[4].mousePressed(() => {quick.create("LED")})

    deleteButton = document.getElementById('deleteButton');
    deleteButton.addEventListener('mouseup', (event) => {
        removeButtonTrigger()
    });

    banner = document.getElementById("dataBanner");
}
function draw(){
    background("#191a1b")
    drawDynamicObjects()
    drawWorld()
    cameraLogic()
    messageManagerTick()
    extra()
    debugMenu()
}
function debugMenu(){
    push()
    fill("#ffffff")
    textAlign(LEFT, TOP)
    textSize(20)
    text(
        (
            debug.camera ? (
                "camera xy: " +
                camera.pos.x.toFixed(2) + ", " + camera.pos.y.toFixed(2) +
                "  zoom: " +
                camera.zoom.toFixed(2) +
                " (" + camera.smoothing.zoomTarget.toFixed(2) + ")" +
                "\nlimits (" +
                camera.limits.min + " - " + camera.limits.max +
                "), zoom factor: " +
                camera.zoomFactor + "\n"
            ) : ""
        ) + 
        (
            debug.mouse ? (
                "mouse: screen(" + mouseX + ", " + mouseY + "), world(" +
                transform.fromScreen.x(mouseX).toFixed(2) + ", " + transform.fromScreen.y(mouseY).toFixed(2) +
                ")\ndata: " + JSON.stringify(mouse, null, 2) + "\n"
            ) : ""
        ) + 
        (
            debug.fps ? (
                "fps: " + round(frameRate())
            ) : ""
        ),
        10,
        5
    )
    pop()
}
function cameraLogic(){
    camera.smoothing.zoomTarget = constrain(
        camera.smoothing.zoomTarget,
        camera.limits.min,
        camera.limits.max
    )
    camera.zoom += (camera.smoothing.zoomTarget - camera.zoom) / max(camera.smoothing.smoothing, 1)
    if(abs(camera.zoom - camera.smoothing.zoomTarget) < camera.smoothing.threshold)
        camera.zoom = camera.smoothing.zoomTarget

    if(debug.camera){
        push()
        textSize(20)
        const center = {x: transform.toScreen.x(0), y: transform.toScreen.y(0)}
        fill("white")
        stroke("black")
        strokeWeight(2)
        text("0, 0", center.x + 30, center.y - 20)
        strokeWeight(5)
        stroke("#c90000")
        const sizeCenterPoint = transform.toScreen.size(20)
        line(center.x - sizeCenterPoint, center.y, center.x + sizeCenterPoint, center.y)
        line(center.x, center.y - sizeCenterPoint, center.x, center.y + sizeCenterPoint)
        
        stroke("#6f6f6f")
        line(width/2 - 10, height/2, width/2 + 10, height/2)
        line(width/2, height/2 - 10, width/2, height/2 + 10)
        pop()
    }

}
function drawWorld(){
    textSize(debug.gates ? transform.toScreen.size(visuals.textSize / 3) : transform.toScreen.size(visuals.textSize) )
    textAlign(CENTER, CENTER)
    strokeWeight(transform.toScreen.size(visuals.strokeWeight))
    
    push()
    for(let obj of connectionsList.values()){
        obj.tick()
    }
    pop()

    for(let gateId of gateList.keys()){
        entity.gate.get(gateId).tick(gateId)
    }
}
function extra(){
    push()
    noStroke()
    fill("red")
    rect(0, height - 3, ease(constrain(resetTimer/width, 0, 1)) * width, 3)
    if(keyIsDown(82)){
        resetTimer += 0.4 * deltaTime
    }else{
        if(resetTimer < 0)
            resetTimer = 0
        if(resetTimer > 0)
            resetTimer -= 1 * deltaTime
    }
    if(resetTimer > width){
        resetAll()
        resetTimer = -3000
    }
    textAlign(LEFT, BOTTOM)
    textSize(24)
    fill(255,0,0, constrain(resetTimer/width, 0, 1)*255)
    text("Reseting...", 10, height - 10)
    pop()
}


class gate {
    constructor(x = 0, y = 0, name = "AND", inputs = 2, outputs = 1){
        this.name = name
        this.pos = {x, y}
        this.io = {inputs, outputs}

        this.dimensions = this.calculateDimensions(inputs, outputs)
        if(name == "LED" || name[0] == "#"){
            this.dimensions.width = this.dimensions.height
        }
        this.inputs = this.createNodes(this.io.inputs, 0)
        this.outputs = this.createNodes(this.io.outputs, this.dimensions.width)
    }
    calculateDimensions(inputs, outputs){
        return{
            width: transform.fromScreen.size(textWidth(" " + this.name + " ")),
            height: max(
                max(inputs, outputs) * visuals.node.spacing,
                transform.fromScreen.size(textLeading() * 1.3)
            )
        }
    }
    createNodes(num, x) {
        const points = [];
        for (let i = 0; i < num; i++) {
            points.push({
                state: false,
                x: x,
                y: (i + 0.5) * this.dimensions.height / num
            });
        }
        return points;
    }
    tick(id){
        this.updateState()
        if(mouse.selected.some(item => item.id.gate === id) && mouse.selected.length > 1){
            fill("rgb(99, 160, 220)")
        }else{
            fill("white")
        }
        if(this.name == "LED") fill(this.inputs[0].state == 0 ? visuals.colors.off : visuals.colors.on)
        // if(this.name[0] == "#") fill(this.outputs[0].state == 0 ? visuals.colors.keys.off : visuals.colors.keys.on)
        rect(
            transform.toScreen.x(this.pos.x),
            transform.toScreen.y(this.pos.y),
            transform.toScreen.size(this.dimensions.width),
            transform.toScreen.size(this.dimensions.height),
            transform.toScreen.size(visuals.roundness)
        )

        fill("black")
        if(this.name == "LED"){
            text(
                this.inputs[0].state == false ? 0 : 1,
                transform.toScreen.x(this.pos.x + this.dimensions.width / 2),
                transform.toScreen.y(this.pos.y + this.dimensions.height / 2 - 3)
            )
        }else if(this.name[0] == "#"){
            text(
                this.name[1],
                transform.toScreen.x(this.pos.x + this.dimensions.width / 2),
                transform.toScreen.y(this.pos.y + this.dimensions.height / 2 - 3)
            )
        }else{
            if(debug.gates){
                text(
                    this.name + "\nxy: " + this.pos.x + ", " + this.pos.y + "\n",
                    transform.toScreen.x(this.pos.x + this.dimensions.width/2),
                    transform.toScreen.y(this.pos.y + this.dimensions.height/2 + 5)
                )
            }else{
                text(
                    this.name,
                    transform.toScreen.x(this.pos.x + this.dimensions.width/2),
                    transform.toScreen.y(this.pos.y + this.dimensions.height/2 - 3)
                )
            }
        }
        
        for(let node of [...this.inputs, ...this.outputs]){
            fill(node.state == 0 ? visuals.colors.off : visuals.colors.on)
            circle(
                transform.toScreen.x(this.pos.x + node.x),
                transform.toScreen.y(this.pos.y + node.y),
                transform.toScreen.size(visuals.node.size)
            )
        }

    }
    updateState(){
        switch(this.name){
            case "AND":
                this.outputs[0].state = int(this.inputs[0].state && this.inputs[1].state)
                break
            case "OR":
                this.outputs[0].state = int(this.inputs[0].state || this.inputs[1].state)
                break
            case "NOT":
                this.outputs[0].state = int(!this.inputs[0].state)
                break
        }
        if(this.name.startsWith("#"))
            this.outputs[0].state = keyIsDown(this.name[1].charCodeAt(0))
    }
}
class connection {
    constructor(from, to, joints = []){
        this.from = from    // {gate: x, index: y}
        this.to = to        // {gate: x, index: y}
        this.state = 0
        this.points = joints
    }
    tick(){
        let fromObj = entity.gate.get(this.from.gate)
        let toObj = entity.gate.get(this.to.gate)
        
        let nodeFrom = fromObj.outputs[this.from.index]
        let nodeTo = toObj.inputs[this.to.index]

        this.state = nodeFrom.state
        nodeTo.state = this.state

        stroke(this.state == 0 ? visuals.colors.off : visuals.colors.on)
        strokeWeight(transform.toScreen.size(8))

        let firstPos = {
            x: transform.toScreen.x(nodeFrom.x + fromObj.pos.x),
            y: transform.toScreen.y(nodeFrom.y + fromObj.pos.y)
        }
        for(let p of this.points){
            line(
                firstPos.x,
                firstPos.y,
                transform.toScreen.x(p.x),
                transform.toScreen.y(p.y)
            )
            firstPos = {
                x: transform.toScreen.x(p.x),
                y: transform.toScreen.y(p.y)
            }
        }
        line(
            firstPos.x,
            firstPos.y,
            transform.toScreen.x(nodeTo.x + toObj.pos.x),
            transform.toScreen.y(nodeTo.y + toObj.pos.y)
        )

    }
}
class dynamicGate {
    constructor(gateToReplicate, animationType, animationTime){
        this.replica = gateToReplicate
        this.animationType = animationType
        this.animationTime = animationTime
        this.time = 0
    }
    tick(){
        this.time += deltaTime
        if(this.time > this.animationTime){
            return("remove")
        }
    }
    render(){
        const inr = 1 - this.getInterpolation()
        fill("white")
        textSize(transform.toScreen.size(visuals.textSize) * inr)
        strokeWeight(transform.toScreen.size(visuals.strokeWeight) * inr)
        if(this.replica.name == "LED") fill(this.replica.inputs[0].state == 0 ? visuals.colors.off : visuals.colors.on)
        // if(this.replica.name[0] == "#") fill(this.replica.outputs[0].state == 0 ? visuals.colors.keys.off : visuals.colors.keys.on)
        rect(
            transform.toScreen.x(this.replica.pos.x),
            transform.toScreen.y(this.replica.pos.y),
            transform.toScreen.size(this.replica.dimensions.width) * inr,
            transform.toScreen.size(this.replica.dimensions.height) * inr,
            transform.toScreen.size(visuals.roundness)
        )

        fill("black")
        if(this.replica.name == "LED"){
            text(
                this.replica.inputs[0].state == false ? 0 : 1,
                transform.toScreen.x(this.replica.pos.x + (this.replica.dimensions.width * inr) / 2),
                transform.toScreen.y(this.replica.pos.y + (this.replica.dimensions.height * inr) / 2 - 3)
            )
        }else if(this.replica.name[0] == "#"){
            text(
                this.replica.name[1],
                transform.toScreen.x(this.replica.pos.x + (this.replica.dimensions.width * inr) / 2),
                transform.toScreen.y(this.replica.pos.y + (this.replica.dimensions.height * inr) / 2 - 3)
            )
        }else{
            text(
                this.replica.name,
                transform.toScreen.x(this.replica.pos.x + (this.replica.dimensions.width * inr)/2),
                transform.toScreen.y(this.replica.pos.y + (this.replica.dimensions.height * inr)/2 - 3)
            )
        }
        
        for(let node of [...this.replica.inputs, ...this.replica.outputs]){
            fill(node.state == 0 ? visuals.colors.off : visuals.colors.on)
            circle(
                transform.toScreen.x(this.replica.pos.x + node.x * inr),
                transform.toScreen.y(this.replica.pos.y + node.y * inr),
                transform.toScreen.size(visuals.node.size) * inr
            )
        }
    }
    getInterpolation(){
        return(constrain(this.time / this.animationTime, 0, 1))
    }
}


let messageTime = -600
function messageManagerTick(){
    if(message == "") return
    push()
    textSize(20)
    fill("white")
    textAlign(RIGHT, TOP)
    posY = 10
    posY = ease(constrain(messageTime, -2000, 500) / 500) * 40 - 30
    posY -= ease(constrain(messageTime - 7500, 0, 500) / 500) * 50
    text(message, width - 15,posY)
    messageTime += deltaTime
    if(messageTime > 8000){
        message = ""
    }
    pop()
}
function newMessage(msg){
    messageTime = -600
    message = msg
}
function ease(t) {
  return t * (2 - t);
}

function windowResized(){
    resizeCanvas(windowWidth, windowHeight)
}
function mouseWheel(event){
    if(event.delta > 0){
        camera.smoothing.zoomTarget *= (1 / camera.zoomFactor)
    }
    else{
        camera.smoothing.zoomTarget /= (1 / camera.zoomFactor)
    }
}

// Functions
const transform = {
    toScreen: {
        x(x){
            return((x - camera.pos.x) * camera.zoom + width/2)
        },
        y(y){
            return((y - camera.pos.y) * camera.zoom + height/2)
        },
        size(size){
            return(size * camera.zoom)
        }
    },
    fromScreen: {
        x(x){
            return(((x - width/2) / camera.zoom) + camera.pos.x)
        },
        y(y){
            return(((y - height/2) / camera.zoom) + camera.pos.y)
        },
        size(size){
            return(size / camera.zoom)
        }
    }
}
const collision = {
    gate(id, x, y){
        const g = gateList.get(id)
        return(
            (x > g.pos.x) &&
            (y > g.pos.y) &&
            (x < g.pos.x + g.dimensions.width) &&
            (y < g.pos.y + g.dimensions.height)
        )
    },
    gateWithNodes(id, x, y){
        const g = gateList.get(id)
        return(
            (x > g.pos.x - visuals.node.size/2) &&
            (y > g.pos.y - visuals.node.size/2) &&
            (x < g.pos.x + g.dimensions.width + visuals.node.size/2) &&
            (y < g.pos.y + g.dimensions.height + visuals.node.size/2)
        )
    },
    node: {
        output(gateId, nodeIndex, x, y){
            const g = entity.gate.get(gateId)
            const n = g.outputs[nodeIndex]
            return(
                sqrt(
                    ((n.x + g.pos.x) - x)**2 +
                    ((n.y + g.pos.y) - y)**2 
                ) <= visuals.node.size/2
            )
        },
        input(gateId, nodeIndex, x, y){
            const g = entity.gate.get(gateId)
            const n = g.inputs[nodeIndex]
            return(
                sqrt(
                    ((n.x + g.pos.x) - x)**2 +
                    ((n.y + g.pos.y) - y)**2 
                ) <= visuals.node.size/2
            )
        }
    }
}
const entity = {
    gate: {
        create(x, y, name, inputs, outputs){
            gateList.set(
                entity.getNextId(gateList),
                new gate(x, y, name, inputs, outputs)
            )
        },
        get(id){
            return(gateList.get(id))
        },
        exist(id){
            return(gateList.has(id))
        },
        remove(id){
            dynamicGates.push(new dynamicGate(this.get(id), 1, 200))
            if(this.exist(id)){
                gateList.delete(id)
                let toRemove = []
                for(let conId of connectionsList.keys()){
                    const con = entity.connection.get(conId)
                    if(con.from.gate == id || con.to.gate == id){
                        toRemove.push(conId)
                    }
                }
                for(let r of toRemove){
                    entity.connection.remove(r)
                }
            }
        },
        move(id, x, y, mode = "world"){
            if(mode == "world"){
                this.get(id).pos = {
                    x: x,
                    y: y,
                }
            }else if(mode == "screen"){
                this.get(id).pos = {
                    x: transform.from.x(x),
                    y: transform.from.y(y),
                }
            }else{
                console.log(
                    `Trying to move gate ${id} to (${x}, ${y}) in mode "${mode}" (excluding "world" and "screen").`
                );
            }
        },
        isInsideBox(id, x, y, x2, y2) {
            if (!this.exist(id)) return false;
            const g = this.get(id);

            const maxX = max(x, x2)
            const maxY = max(y, y2)
            const minX = min(x, x2)
            const minY = min(y, y2)

            return (
                g.pos.x + g.dimensions.width >= minX &&
                g.pos.y + g.dimensions.height >= minY &&
                g.pos.x <= maxX &&
                g.pos.y <= maxY
            );
        }
    },
    connection: {
        create(from, to, joints = []){
            if(from.index == -1 || to.index == -1){
                console.warn("connection was trying to connect to a missing node")
                return("unable to conect to missing node")
            }
            if(entity.gate.exist(from.gate) && entity.gate.exist(to.gate)){
                connectionsList.set(
                    entity.getNextId(connectionsList),
                    new connection(from, to, joints)
                )
                return("successful")
            }else{
                console.warn("connection was trying to connect to a missing gate")
                return("unable to conect to missing gate")
            }
        },
        get(id){
            return(connectionsList.get(id))
        },
        exist(id){
            return(connectionsList.has(id))
        },
        remove(id){
            if(this.exist(id)){
                connectionsList.delete(id)
            }
        }
    },
    getNextId(map) {
        let id = 0;

        while (map.has(id)) {
            id++;
        }

        return id;
    }
}
const preset = {
    // name, inputs, outputs
    AND: ["AND", 2, 1],
    OR: ["OR", 2, 1],
    XOR: ["XOR", 2, 1],
    NOT: ["NOT", 1, 1],
    CLOCK: ["CLK", 0, 1],
    LED: ["LED", 1, 0]
}
const quick = {
    create(type) {
        if(!preset[type]){
            entity.gate.create(
                transform.fromScreen.x(mouseX) + 1000,
                transform.fromScreen.y(mouseY) + 1000,
                type.toUpperCase(),
                0,
                1
            )
        }else{
            entity.gate.create(
                transform.fromScreen.x(mouseX) + 1000,
                transform.fromScreen.y(mouseY) + 1000,
                ...preset[type]
            )
        }
        mouse.grabGate(Array.from(gateList.keys()).pop())
    }
}




// --------- MOUSE ---------
let mouse = {
    drawingConnection: false,
    mode: "idle",
    selected: [],
    start: {x: 0, y: 0},
    startWorld: {x: 0, y: 0},
    selectingBox: {start: {x: 0, y: 0}, end: {x: 0, y: 0}, active: false},
    points: [],
    clickAccepted: false,


    click(){

        //CLICK STARTED
        
        //save start positions
        mouse.start = {x: mouseX, y: mouseY}
        mouse.startWorld = {x: transform.fromScreen.x(mouseX), y: transform.fromScreen.y(mouseY)}

        if(mouse.mode == "idle"){
            // execute from idle state
            if(keyIsDown(ALT)){
                // area select
                mouse.mode = "selecting"
                mouse.selectingBox = {
                    start: {
                        x: mouse.startWorld.x,
                        y: mouse.startWorld.y,
                    },
                    end: {
                        x: mouse.startWorld.x,
                        y: mouse.startWorld.y,
                    },
                    active: true
                }
                mouse.selected = []
            }else{
                // click select
                let grabOffset = {x: 0, y: 0}
                let selected = {
                    gate: getHoveredGate("nodes"),
                    index: getHoveredNode(getHoveredGate("nodes"), "outputs"),
                }
                if(selected.index == -1 && selected.gate != -1){
                    const selGate = getHoveredGate("precise")
                    if(entity.gate.exist(selGate)){
                        selected = {
                            gate: selGate,
                            index: -1,
                        }
                        grabOffset = {
                            x: transform.fromScreen.x(mouseX) - entity.gate.get(selGate).pos.x,
                            y: transform.fromScreen.y(mouseY) - entity.gate.get(selGate).pos.y
                        }
                    }else{
                        selected = {
                            gate: -1,
                            index: -1
                        }
                    }
                }
                if(
                    mouse.selected.some(item => item.id.gate === selected.gate) &&
                    mouse.selected.some(item => item.id.index === selected.index) &&
                    selected.index == -1
                ){
                    for(let obj of mouse.selected){
                        obj.grabOffset = {
                            x: transform.fromScreen.x(mouseX) - entity.gate.get(obj.id.gate).pos.x,
                            y: transform.fromScreen.y(mouseY) - entity.gate.get(obj.id.gate).pos.y
                        }
                    }
                }else{
                    if(selected.gate != -1){
                        if(selected.index != -1){
                            mouse.drawingConnection = true
                        }
                        mouse.selected = []
                        mouse.selected.push(
                            {
                                mode: selected.index >= 0 ? "node" : "gate",
                                id: selected,
                                grabOffset: grabOffset
                            }
                        )
                    }
                    else{
                        mouse.selected = []
                        mouse.selected.push(
                            {
                                mode: "camera",
                                id: -1,
                                start: {
                                    ...camera.pos
                                }
                            }
                        )
                    }
                }
            }

        }else if(mouse.mode == "selected"){
            mouse.mode = "idle"
        }else if(mouse.mode == "plotting"){
            let selected = {
                gate: getHoveredGate("nodes"),
                index: getHoveredNode(getHoveredGate("nodes"), "inputs"),
            }
            if (selected.index == -1 && selected.gate != -1) {
                const selGate = getHoveredGate("precise")
                if (entity.gate.exist(selGate)) {
                    selected = {
                        gate: selGate,
                        index: -1,
                    }
                } else {
                    selected = {
                        gate: -1,
                        index: -1
                    }
                }
            }
            if(selected.index != -1){
                entity.connection.create(mouse.selected[0].id, selected, mouse.points)
                mouse.points = []
                mouse.mode = "idle"
                mouse.drawingConnection = false
            }
        }
    },
    drag(){
        if(mouse.mode == "idle" || mouse.mode == "dragging"){
            mouse.mode = "dragging"
            for(let obj of mouse.selected){
                if(obj.mode == "gate"){
                    calculeIfShowDeleteButton()
                    if(keyIsDown(SHIFT)){
                        entity.gate.move(
                            obj.id.gate,
                            roundGrid(transform.fromScreen.x(mouseX) - obj.grabOffset.x, settings.snapGrid),
                            roundGrid(transform.fromScreen.y(mouseY) - obj.grabOffset.y, settings.snapGrid),
                            "world"
                        )
                    }else{
                        entity.gate.move(
                            obj.id.gate,
                            transform.fromScreen.x(mouseX) - obj.grabOffset.x,
                            transform.fromScreen.y(mouseY) - obj.grabOffset.y,
                            "world"
                        )
                    }
                }
                if(obj.mode == "camera"){
                    camera.pos = {
                        x: obj.start.x + transform.fromScreen.x(mouse.start.x) - transform.fromScreen.x(mouseX),
                        y: obj.start.y + transform.fromScreen.y(mouse.start.y) - transform.fromScreen.y(mouseY),
                    }
                }
            }
        }else if(mouse.mode == "selecting"){
            mouse.select
            mouse.selectingBox.end = {
                x: transform.fromScreen.x(mouseX),
                y: transform.fromScreen.y(mouseY)
            }
        }
    },
    release(){
        hideDeleteButton()
        if(mouse.mode == "selecting"){
            mouse.drawingConnection = false
            mouse.mode = "idle"
            mouse.selectingBox.active = false
            mouse.selected = []
            for(let gateId of getGatesInsideBox(
                mouse.selectingBox.start.x,
                mouse.selectingBox.start.y,
                mouse.selectingBox.end.x,
                mouse.selectingBox.end.y
            )){
                mouse.selected.push({
                    mode: "gate",
                    id: {
                        gate: gateId,
                        index: -1
                    },
                    grabOffset: {x: 0, y: 0}
                })
            }
        }else if(mouse.mode == "dragging"){
            if(mouse.drawingConnection){
                let selected = {
                    gate: getHoveredGate("nodes"),
                    index: getHoveredNode(getHoveredGate("nodes"), "inputs"),
                }
                if (selected.index == -1 && selected.gate != -1) {
                    const selGate = getHoveredGate("precise")
                    if (entity.gate.exist(selGate)) {
                        selected = {
                            gate: selGate,
                            index: -1,
                        }
                    } else {
                        selected = {
                            gate: -1,
                            index: -1
                        }
                    }
                }
                entity.connection.create(mouse.selected[0].id, selected)
                mouse.drawingConnection = false
            }
            mouse.mode = "idle"
        }else if(mouse.mode == "idle"){
            mouse.drawingConnection = false
            if(mouse.selected[0].id.index != -1){
                let selected = {
                    gate: getHoveredGate("nodes"),
                    index: getHoveredNode(getHoveredGate("nodes"), "outputs"),
                }
                if (selected.index == -1 && selected.gate != -1) {
                    const selGate = getHoveredGate("precise")
                    if (entity.gate.exist(selGate)) {
                        selected = {
                            gate: selGate,
                            index: -1,
                        }
                    } else {
                        selected = {
                            gate: -1,
                            index: -1
                        }
                    }
                }
                if(JSON.stringify(mouse.selected[0].id) == JSON.stringify(selected)){
                    mouse.mode = "plotting"
                    mouse.drawingConnection = true
                    mouse.points = []
                }else{
                    mouse.mode = "idle"
                }
            }
        }else if(mouse.mode == "plotting"){
            if(keyIsDown(SHIFT)){
                let lastPoint = mouse.points[mouse.points.length - 1]
                if(!lastPoint){
                    const gateEntity = entity.gate.get(mouse.selected[0].id.gate)
                    const nodeEntity = gateEntity.outputs[mouse.selected[0].id.index]
                    lastPoint = {
                        x: nodeEntity.x + gateEntity.pos.x, 
                        y: nodeEntity.y + gateEntity.pos.y
                    }
                }
                if(abs(lastPoint.x - mouse.startWorld.x) < abs(lastPoint.y - mouse.startWorld.y)){
                    mouse.points.push({x: lastPoint.x, y: mouse.startWorld.y})
                }else{
                    mouse.points.push({x: mouse.startWorld.x, y: lastPoint.y})
                }
            }else{
                mouse.points.push({x: mouse.startWorld.x, y: mouse.startWorld.y})
            }
        }

    },
    grabGate(id){
        mouse.hoveredGate = id
        mouse.mode = "dragging"
        mouse.selected = [{
            mode: "gate",
            id: {
                gate: id,
                index: -1
            },
            grabOffset: {
                x: entity.gate.get(id).dimensions.width/2,
                y: entity.gate.get(id).dimensions.height/2
            }
        }]
        mouse.start = {x: mouseX, y: mouseY}
        mouse.startWorld = {x: transform.fromScreen.x(mouseX), y: transform.fromScreen.y(mouseY)}
        moveAtTop(mouse.hoveredGate)
    }
}
function mousePressed(e){
    if(mouseButton == LEFT){
        mouse.click()
    }
}
function mouseDragged(e){
    if(mouseButton == LEFT){
        mouse.drag()
    }
}
function mouseReleased(e){
    if(mouseButton == LEFT){
        mouse.release()
    }
}

// --------- HITBOX UTILS ----------
function getGatesInsideBox(x, y, x2, y2){
    let gatesAffected = []
    for(let gateId of gateList.keys()){
        if(entity.gate.isInsideBox(gateId, x, y, x2, y2)){
            gatesAffected.push(gateId)
        }else{
        }
    }
    return(gatesAffected)
}
function getHoveredGate(mode = "precise"){
    if(mode == "precise"){
        for(let id of gateList.keys()){
            if(collision.gate(id, transform.fromScreen.x(mouseX), transform.fromScreen.y(mouseY)))
                return(id)
        }
    }else if(mode == "nodes"){
        for(let id of gateList.keys()){
            if(collision.gateWithNodes(id, transform.fromScreen.x(mouseX), transform.fromScreen.y(mouseY)))
                return(id)
        }
    }else{
        return("mode should be precise or nodes")
    }
    return(-1)
}
function getHoveredNode(gateId, io = "inputs"){
    if(!entity.gate.exist(gateId)) return(-1)
    const gateObj = entity.gate.get(gateId)
    if(io == "outputs"){
        for(let nodeIndex in gateObj.outputs){
            if(collision.node.output(gateId, nodeIndex, transform.fromScreen.x(mouseX), transform.fromScreen.y(mouseY)))
                return(int(nodeIndex))
        }
    }else if(io == "inputs"){
        for(let nodeIndex in gateObj.inputs){
            if(collision.node.input(gateId, nodeIndex, transform.fromScreen.x(mouseX), transform.fromScreen.y(mouseY)))
                return(int(nodeIndex))
        }
    }else{
        return("io should be inputs or outputs")
    }
    return(-1)
}

function drawDynamicObjects(){
    if(mouse.drawingConnection){
        push()
        const gateEntity = entity.gate.get(mouse.selected[0].id.gate)
        const nodeEntity = gateEntity.outputs[mouse.selected[0].id.index]

        strokeWeight(transform.toScreen.size(8))
        stroke(nodeEntity.state == 0 ? visuals.colors.off : visuals.colors.on)
        let firstPos = {
            x: transform.toScreen.x(nodeEntity.x + gateEntity.pos.x),
            y: transform.toScreen.y(nodeEntity.y + gateEntity.pos.y)
        }
        for(let p of mouse.points){
            line(
                firstPos.x,
                firstPos.y,
                transform.toScreen.x(p.x),
                transform.toScreen.y(p.y)
            )
            firstPos = {
                x: transform.toScreen.x(p.x),
                y: transform.toScreen.y(p.y)
            }
        }
        if(keyIsDown(SHIFT)){
            let lastPoint = mouse.points[mouse.points.length - 1]
            if(!lastPoint){
                const gateEntity = entity.gate.get(mouse.selected[0].id.gate)
                const nodeEntity = gateEntity.outputs[mouse.selected[0].id.index]
                lastPoint = {
                    x: transform.toScreen.x(nodeEntity.x + gateEntity.pos.x), 
                    y: transform.toScreen.y(nodeEntity.y + gateEntity.pos.y)
                }
            }else{
                lastPoint = {
                    x: transform.toScreen.x(lastPoint.x),
                    y: transform.toScreen.y(lastPoint.y)
                }
            }
            if(abs(lastPoint.x - mouseX) < abs(lastPoint.y - mouseY)){
                line(
                    firstPos.x,
                    firstPos.y,
                    lastPoint.x,
                    mouseY
                )
            }else{
                line(
                    firstPos.x,
                    firstPos.y,
                    mouseX,
                    lastPoint.y
                )
            }
        }else{
            line(
                firstPos.x,
                firstPos.y,
                mouseX,
                mouseY
            )
        }
        pop()
    }
    if(mouse.mode == "selecting"){
        push()
        stroke("#0095ff")
        strokeWeight(3)
        fill("#0095ff65")
        rectCord(
            transform.toScreen.x(mouse.selectingBox.start.x),
            transform.toScreen.y(mouse.selectingBox.start.y),
            transform.toScreen.x(mouse.selectingBox.end.x),
            transform.toScreen.y(mouse.selectingBox.end.y)
        )
        pop()
    }

    // dynamic gates
    let toRemove = []
    for(let dyn in dynamicGates){
        if(dynamicGates[dyn].tick()){
            toRemove.push(dyn)
        }
        dynamicGates[dyn].render()
    }
    const sortedIndices = [...toRemove].sort((a, b) => b - a);
    for (const index of sortedIndices) {
        if (index >= 0 && index < dynamicGates.length) {
            dynamicGates.splice(index, 1);
        }
    }
}
function centerCanvas(){
    if(gateList.size == 0){
        camera.pos.x = 0
        camera.pos.y = 0
        camera.smoothing.zoomTarget = 2
        camera.zoom = 2
        return
    }

    let maximus = {x: -Infinity, y: -Infinity}
    let minimus = {x: Infinity, y: Infinity}

    for(let n of gateList.values()){
        maximus.x = max(maximus.x, n.pos.x + n.dimensions.width)
        maximus.y = max(maximus.y, n.pos.y + n.dimensions.height)
        minimus.x = min(minimus.x, n.pos.x)
        minimus.y = min(minimus.y, n.pos.y)
    }
    camera.pos = {
        x: (maximus.x + minimus.x) / 2,
        y: (maximus.y + minimus.y) / 2
    }

    const maxDistance = sqrt((maximus.x - minimus.x)**2 + (maximus.y - minimus.y)**2)
    camera.smoothing.zoomTarget = 1000 / maxDistance
    camera.zoom = 800 / maxDistance
}
function moveAtTop(id) {
    if (!gateList.has(id)) return;

    const gate = gateList.get(id);

    gateList.delete(id);
    gateList.set(id, gate);
}
function keyPressed(){
    if(mouse.mode == "dragging" && mouse.selected[0].mode == "gate" && entity.gate.get(mouse.selected[0].id.gate).name[0] == "#"){
        entity.gate.get(mouse.selected[0].id.gate).name = "#" + key.toUpperCase()
    }
    else{
        if(key == "c"){
            centerCanvas()
        }
        if(key == "Delete" && mouse.selected[0].mode == "gate"){
            for(let obj of mouse.selected){
                entity.gate.remove(obj.id.gate)
            }
            mouse.mode = "idle"
            mouse.selected = []
        }
    }
}
function rectCord(x, y, x2, y2){
    rect(
        x,
        y,
        x2 - x,
        y2 - y
    )
}
function roundGrid(value, grid){
    return(round(value / grid) * grid)
}

// DELETE BUTTON
let deleteButtonEstate = "hide"
function showDeleteButton() {
    const menu = document.getElementById("menu");
    deleteButtonEstate = "show"

    menu.classList.add("hide");
    deleteButton.classList.add("show");
}
function hideDeleteButton() {
    const menu = document.getElementById("menu");
    deleteButtonEstate = "hide"

    deleteButton.classList.remove("show");
    menu.classList.remove("hide");
}
function calculeIfShowDeleteButton(){
    const menu = document.getElementById("menu");
    const rect = menu.getBoundingClientRect();
    let deltaY = mouseY - pmouseY;
    if(
        mouseY > rect.top - 15 &&
        deleteButtonEstate == "hide" &&
        deltaY > 0 &&
        abs(deltaY) > 3
    ){
        showDeleteButton()
    }
    else if(
        mouseY < rect.top - 15 &&
        deleteButtonEstate == "show"
    ){
        hideDeleteButton()
    }
}
function removeButtonTrigger(){
    for(let obj of mouse.selected){
        if(obj.mode == "gate"){
            entity.gate.remove(obj.id.gate)
        }
    }
}
window.addEventListener("beforeunload", () => {
    if(getItem("dataCollectAccepted") == true){
        storeItem("sketch", compressSketch())
    }
});
function dataCollect(msg){
    banner.classList.add("hide");
    if(msg == "accepted"){
        newMessage("Next time you log in i'll remember you!")
        storeItem("dataCollectAccepted", true)
    }
    else if(msg == "denied"){
        newMessage("You'll lose your work when you exit,\nplease be aware...")
    }
}
function isOnCanvas(e) {
    return e.target === canvas.elt;
}
function resetAll(){
    for(let id of gateList.keys()){
        entity.gate.remove(id)
    }
    camera.x = 0,
    camera.y = 0
    if(gateList.size > 0){
        newMessage("Nice and clean.")
    }
}

function compressSketch(){
    let compresed = [[], []]
    for(let obj of gateList.keys()){
        compresed[0].push(getEssentialDataFromGate(obj))
    }
    for(let obj of connectionsList.keys()){
        compresed[1].push(getEssentialDataFromConnection(obj))
    }
    return(JSON.stringify(compresed))
}
function loadSketch(data){
    gateList.clear()
    connectionsList.clear()
    let uncompresed = JSON.parse(data)
    textSize(transform.toScreen.size(visuals.textSize))
    for(let obj of uncompresed[0]){
        gateList.set(obj.id, new gate(obj.x, obj.y, obj.name, obj.inputs, obj.outputs))
    }
    for(let obj of uncompresed[1]){
        connectionsList.set(obj.id, new connection(obj.from, obj.to, obj.joints))
    }
    centerCanvas()
    if(uncompresed[0].length > 0){
        return(true)
    }else{
        return(false)
    }
}
function getEssentialDataFromGate(id){
    if(!entity.gate.exist(id)) return
    const obj = entity.gate.get(id)
    return({
        id: id,
        name: obj.name,
        x: obj.pos.x,
        y: obj.pos.y,
        inputs: obj.io.inputs,
        outputs: obj.io.outputs,
    })
}
function getEssentialDataFromConnection(id){
    if(!entity.connection.exist(id)) return
    const obj = entity.connection.get(id)
    return({
        id: id,
        from: obj.from,
        to: obj.to,
        joints: obj.points
    })
}
