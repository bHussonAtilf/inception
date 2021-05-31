/*
 * Licensed to the Technische Universität Darmstadt under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The Technische Universität Darmstadt
 * licenses this file to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Client, Stomp} from '@stomp/stompjs';

class AnnotationExperienceAPI {

    //Websocket and stomp broker
    stompClient: Client;
    connected: boolean = false;

    //States to remember by client
    username: string;
    projectID: string;
    documentID: string;

    //Viewport
    viewPortBegin: number;
    viewPortEnd: number;
    viewPortSize: number;

    //Text
    text: String[];
    sentenceNumbers: boolean = true;
    annotations: Object[];

    //Editor element
    editor: string;
    lineColorFirst: string = "#BBBBBB";
    lineColorSecond: string = "#CCCCCC";


    constructor(aEditor: string, aViewPortSize: number) {
        this.editor = aEditor;
        this.viewPortSize = aViewPortSize;
        this.connect();
    }


    //CREATE WEBSOCKET CONNECTION
    connect() {
        if (this.connected) {
            console.log("You are already connected")
            return;
        }

        let url: string = (window.location.protocol.startsWith("https") ? "wss://" : "ws://")
            + window.location.host
            + "/inception_app_webapp_war_exploded/ws-endpoint";

        this.stompClient = Stomp.over(function () {
            return new WebSocket(url);
        });

        const that = this;

        this.stompClient.onConnect = function (frame) {
            that.connected = true;

            //Receive username from inital message exchange header
            const header = frame.headers;
            let data: keyof typeof header;
            for (data in header) {
                that.username = header[data];
                break;
            }

            //Receive project and document from URL
            that.projectID = document.location.href.split("/")[5];
            that.documentID = document.location.href.split("=")[1].split("&")[0];

            // ------ DEFINE SUBSCRIPTION CHANNELS WITH ACTIONS ------ //

            that.stompClient.subscribe("/queue/new_document_for_client/" + that.username, function (msg) {
                that.receiveNewDocumentMessageByServer(JSON.parse(msg.body));
            }, {id: "new_document"});

            that.stompClient.subscribe("/queue/new_viewport_for_client/" + that.username, function (msg) {
                that.receiveNewViewportMessageByServer(JSON.parse(msg.body));
            }, {id: "new_viewport"});

            that.stompClient.subscribe("/queue/selected_annotation_for_client/" + that.username, function (msg) {
                that.receiveSelectedAnnotationMessageByServer(JSON.parse(msg.body));
            }, {id: "selected_annotation"});

        };

        // ------ ERROR HANDLING ------ //

        this.stompClient.onStompError = function (frame) {
            console.log('Broker reported error: ' + frame.headers['message']);
            console.log('Additional details: ' + frame.body);
        };

        this.stompClient.activate();

    }

    // ------ DISCONNECT -------- //
    disconnect() {
        if (this.connected) {
            console.log("Disconnecting now");
            this.connected = false;
            this.stompClient.deactivate();
        }
    }

    // ------------------------------- //


    /** ----------- Actions ----------- **/

    registerOnClickActionHandler(aTagName: string, aAction: string)
    {
        let that = this;

        let elem = document.querySelector("." + aTagName);
        if (elem !=  null) {
            //Click events on annotation page specific items
            switch (aAction) {
                case "select":
                    for (let item of document.getElementsByClassName(aTagName)) {
                        item.setAttribute("onclick", 'AnnotationExperienceAPI.sendSelectAnnotationMessageToServer(evt.target.attributes[3])');
                    }
                    break;
                case "new_document":
                    elem.addEventListener("click", () => {
                        that.sendDocumentMessageToServer();
                    });
                    break;
                case "next_sentences":
                    elem.addEventListener("click", () => {
                        that.sendViewportMessageToServer(that.viewPortEnd + 1, that.viewPortEnd + that.viewPortSize);
                    });
                    break;
                case "previous_sentences":
                    elem.addEventListener("click", () => {
                        that.sendViewportMessageToServer(that.viewPortBegin - that.viewPortSize, that.viewPortBegin - 1);
                    });
                    break;
                case "last_sentences":
                    //aBegin = -100, aEnd = size

                    elem.addEventListener("click", () => {
                        that.sendViewportMessageToServer(-100, that.viewPortSize);
                    });
                    break;
                case "first_sentences":
                    elem.addEventListener("click", () => {
                        that.sendViewportMessageToServer(0, that.viewPortSize - 1);
                    });
                    break;
                default:
                    console.error("Can not register single click action, reason: Action-type not found.");
                    return;
            }

            console.log("Action: " + aAction + " is registered for elements: " + aTagName)
        } else {
            console.error("Can not register single click action, reason: Element not found.");
        }
    }

    registerOnDoubleClickActionHandler(aTagName: string, aAction: string)
    {
        let elements = document.getElementsByClassName(aTagName);
        if (elements !=  null) {
            switch (aAction) {
                case  "create":
                    for (let item of elements) {
                        item.setAttribute("ondblclick",
                            'annotationExperienceAPI.sendCreateAnnotationMessageToServer(evt.target.attributes[3].value,' +
                            'document.getElementsByClassName("dropdown")[0].children[1].getAttribute("title"),' +
                            'evt.target.parentElement.attributes[1].value)');
                    }
                    break;
                default:
                    console.error("Can not register double click action, reason: Action-type not found.")
                    return;
            }
        }

        console.log("Action: " + aAction + " is registered for elements: " + aTagName)
    }

    registerDefaultActionHandler()
    {
        this.registerOnClickActionHandler("annotation", "select");
        this.registerOnClickActionHandler("fa-caret-square-right", "new_document");
        this.registerOnClickActionHandler("fa-caret-square-left", "new_document");
        this.registerOnClickActionHandler("fa-step-forward", "next_sentences");
        this.registerOnClickActionHandler("fa-step-backward", "previous_sentences");
        this.registerOnClickActionHandler("fa-fast-forward", "last_sentences");
        this.registerOnClickActionHandler("fa-fast-backward", "first_sentences");

        this.registerOnDoubleClickActionHandler("word", "create")
        this.registerOnDoubleClickActionHandler("stop", "create")
    }

    showText(aElementId: string)
    {
        if (this.editor == null) {
            this.editor = aElementId;
        }
        let textArea = document.getElementById(aElementId.toString())
        //Reset previous text
        textArea.innerHTML = '';

        //SVG element
        let svg = document.createElement("svg");
        svg.setAttribute("version", "1.2");
        svg.setAttribute("viewbox", "0 0 1415 " + this.text.length * 20);
        svg.style.display = "font-size: 100%; width: 1417px; height: 65px";

        //Sentencenumbers enabled

        svg.appendChild(this.createBackground());

        if (this.sentenceNumbers) {
            svg.appendChild(this.createSentenceNumbers())
        }

        let k = 0;

        let textElement = document.createElement("g");
        textElement.className = "text";

        for (let i = 0; i < this.viewPortSize; i++) {
            let words = this.text[i].split(" ");
            let sentence = document.createElement("g");
            sentence.className = "text-row";
            sentence.style.display = "block";
            sentence.setAttribute("sentence-id", (this.viewPortBegin + i).toString());

            let spaceElement = document.createElement("text");
            spaceElement.className = "space";
            spaceElement.innerText = " ";
            spaceElement.setAttribute("x",  "0");
            spaceElement.setAttribute("y", ((i + 1) * 20 - 5).toString());
            spaceElement.setAttribute("word_id", k.toString());

            sentence.appendChild(spaceElement);
            let xPrev : number;
            if (this.sentenceNumbers) {
                xPrev = 45;
            } else {
                xPrev = 4;
            }


            for (let j = 0; j <= words.length; j++, k++) {
                if (j < words.length) {
                    let word = document.createElement("text");
                    word.innerText = words[j]
                    word.className = "word";
                    word.setAttribute("x", xPrev.toString());
                    word.setAttribute("y", ((i + 1) * 20 - 5).toString());
                    word.setAttribute("word_id", k.toString());
                    xPrev += word.innerText.length * 9;
                    sentence.appendChild(word);

                    if (j != words.length - 1) {
                        spaceElement = document.createElement("text");
                        spaceElement.className = "space";
                        spaceElement.innerText = " ";
                        spaceElement.setAttribute("x",  xPrev.toString());
                        spaceElement.setAttribute("y", ((i + 1) * 20 - 5).toString());
                        spaceElement.setAttribute("word_id", k.toString());
                        xPrev += 4;
                        sentence.appendChild(spaceElement);
                    }
                } else {
                    let fullStopElement = document.createElement("text");
                    fullStopElement.className = "stop";
                    fullStopElement.innerText = ".";
                    fullStopElement.setAttribute("x",  (xPrev + 4).toString());
                    fullStopElement.setAttribute("y", ((i + 1) * 20 - 5).toString());
                    fullStopElement.setAttribute("word_id", k.toString());
                    sentence.appendChild(fullStopElement);
                }
            }
            textElement.appendChild(sentence);
        }

        svg.appendChild(textElement);


        //Highlighting
        svg.appendChild(this.drawAnnotation(this.annotations));

        textArea.appendChild(svg);
    }

    showSentenceNumbers(aSentenceNumbers: boolean)
    {
        this.sentenceNumbers = aSentenceNumbers;
        this.refreshEditor();
    }

    createSentenceNumbers()
    {
        //Sentencenumbers
        let sentenceNumbers = document.createElement("g");
        sentenceNumbers.className = "text";
        for (let i = 0; i < this.viewPortSize; i++) {
            let number = document.createElement("text")
            number.className = "sn";
            number.innerText = (this.viewPortBegin + i + 1).toString() + "."
            number.setAttribute("x", "10");
            number.setAttribute("y", ((i + 1) * 20 - 5).toString());
            sentenceNumbers.appendChild(number);
        }
        return sentenceNumbers;
    }

    createBackground()
    {
        //Background
        let background = document.createElement("g");
        background.className = "background";

        for (let i = 0; i < this.viewPortSize; i++) {
            let rect = document.createElement("rect");
            rect.setAttribute("x", "0");
            rect.setAttribute("y", (i * 20).toString());
            rect.setAttribute("width", "100%");
            rect.setAttribute("height", "20");
            if (i % 2 == 0) {
                rect.setAttribute("fill", this.lineColorFirst);
            } else{
                rect.setAttribute("fill", this.lineColorSecond);
            }
            background.appendChild(rect);
        }
        return background;
    }

    drawAnnotation(aAnnotations: Object[])
    {

        console.log(this.annotations)
        let highlighting = document.createElement("g");
        highlighting.className = "highlighting";

        highlighting.innerHTML = "";

        if (aAnnotations.length > 0) {
            //Parse data
            let keys = Object.keys(aAnnotations)
            let values = keys.map(k => aAnnotations[k])

            let offset : number;
            if (this.sentenceNumbers) {
                offset = 45;
            } else {
                offset = 4;
            }

            for (let val of values) {
                let annotation = document.createElement("g");
                annotation.className = "annotation";

                let rect = document.createElement("rect");
                rect.setAttribute("x", (Number(val.begin * 8) + offset).toString());
                rect.setAttribute("y", "0");
                rect.setAttribute("width", (Number(val.word.length * 8).toString()));
                rect.setAttribute("height", "20");
                rect.setAttribute("id", val.id);
                rect.setAttribute("type", val.type);
                rect.setAttribute("fill", this.getColorForAnnotation(val.type));
                rect.style.opacity = "0.5";

                annotation.appendChild(rect);
                highlighting.appendChild(annotation);
            }
            return highlighting;
        } else {
            return highlighting;
        }
    }

    editAnnotation()
    {

    }

    getColorForAnnotation(type: string)
    {
        return "#87CEEB";
    }

    setLineColors(aLineColorFirst: string, aLineColorSecond: string)
    {
        this.lineColorFirst = aLineColorFirst;
        this.lineColorSecond = aLineColorSecond;

        this.refreshEditor();
    }

    resetLineColor()
    {
        this.lineColorFirst = "#BBBBBB";
        this.lineColorSecond = "#CCCCCC"

        this.refreshEditor();
    }

    setViewportSize(aSize: number)
    {
        this.viewPortSize = aSize;
        this.viewPortEnd = this.viewPortBegin + aSize - 1;
        this.sendViewportMessageToServer(this.viewPortBegin, this.viewPortEnd);
    }

    refreshEditor()
    {
        this.showText(this.editor);
        this.drawAnnotation(this.annotations);

        let editor = document.getElementById("textarea");
        let content = editor.innerHTML;
        editor.innerHTML = content;

    }

    unsubscribe(aChannel: string)
    {
        this.stompClient.unsubscribe(aChannel);
    }

    /** ----------- Event handling ------------------ **/

    // ---------------- SEND ------------------------- //
    sendDocumentMessageToServer()
    {
        let json = {
            username: this.username,
            project: this.projectID,
            viewPortSize: this.viewPortSize
        };
        this.stompClient.publish({destination: "/app/new_document_by_client", body: JSON.stringify(json)});
    }

    sendViewportMessageToServer(aBegin: number, aEnd: number)
    {
        if (aBegin < 0 && aBegin != -100) {
            aBegin = 0;
            aEnd = this.viewPortSize - 1;
        }

        let json = {
            username: this.username,
            project: this.projectID,
            document: this.documentID,
            begin: aBegin,
            end: aEnd
        };
        this.stompClient.publish({destination: "/app/new_viewport_by_client", body: JSON.stringify(json)});
    }

    sendSelectAnnotationMessageToServer(aId: string)
    {
        let json = {
            username: this.username,
            project: this.projectID,
            document: this.documentID,
            id: aId
        };
        this.stompClient.publish({destination: "/app/select_annotation_by_client", body: JSON.stringify(json)});
    }

    sendCreateAnnotationMessageToServer(aId: string, aType: string, aViewport: string)
    {
        let json = {
            username: this.username,
            project: this.projectID,
            document: this.documentID,
            id: aId,
            type: aType,
            viewport: aViewport
        }
        this.stompClient.publish({destination: "/app/new_annotation_by_client", body: JSON.stringify(json)});
    }

    sendUpdateAnnotationMessageToServer(aId: string, aType: string,)
    {
        let json = {
            username: this.username,
            project: this.projectID,
            document: this.documentID,
            id: aId,
            type: aType
        }
        this.stompClient.publish({destination: "/app/delete_annotation_by_client", body: JSON.stringify(json)});
    }

    sendDeleteAnnotationMessageToServer(aId: string)
    {
        let json = {
            username: this.username,
            project: this.projectID,
            document: this.documentID,
            id: aId,
        }
        this.stompClient.publish({destination: "/app/delete_annotation_by_client", body: JSON.stringify(json)});
    }

    // ---------------- RECEIVE ----------------------- //

    receiveNewDocumentMessageByServer(aMessage: string)
    {
        console.log('RECEIVED DOCUMENT: ' + aMessage);

        const that = this;

        //Parse data
        let keys = Object.keys(aMessage)
        let values = keys.map(k => aMessage[k])

        this.documentID = values[0];
        this.text = values[1];
        this.annotations = [];
        this.annotations = values[2];

        //Unsubscribe channels for previous document
        for (let i = this.viewPortBegin; i < this.viewPortBegin + this.viewPortSize; i++) {
            this.unsubscribe("annotation_update_" + i.toString());
        }

        this.viewPortBegin = 0;
        this.viewPortEnd = this.viewPortSize - 1;

        //Multiple subscriptions due to viewport
        for (let i = 0; i < this.viewPortSize; i++) {
            this.stompClient.subscribe("/topic/annotation_update_for_clients/" + this.projectID + "/" + this.documentID + "/" + i, function (msg) {
                that.receiveAnnotationMessageByServer(JSON.parse(msg.body));
            }, {id: "annotation_update_" + i});
        }

        //Refresh
        this.refreshEditor();
    }

    receiveNewViewportMessageByServer(aMessage: string)
    {
        console.log('RECEIVED VIEWPORT: ' + aMessage);

        const that = this;

        //Parse data
        let keys = Object.keys(aMessage)
        let values = keys.map(k => aMessage[k])

        //Unsubscribe channels for previous document
        for (let i = this.viewPortBegin; i < this.viewPortBegin + this.viewPortSize; i++) {
            this.unsubscribe("annotation_update_" + i.toString());
        }

        this.viewPortBegin = values[0];
        this.viewPortEnd = values[1];
        this.text = values[2];
        this.annotations = [];
        this.annotations = values[3];


        //Multiple subscriptions due to viewport
        for (let i = this.viewPortBegin; i < this.viewPortBegin + this.viewPortSize; i++) {
            this.stompClient.subscribe("/topic/annotation_update_for_clients/" + this.projectID + "/" + this.documentID + "/" + i, function (msg) {
                that.receiveAnnotationMessageByServer(JSON.parse(msg.body));
            }, {id: "annotation_update_" + i});
        }

        //Refresh
        this.refreshEditor();

    }

    receiveSelectedAnnotationMessageByServer(aMessage: string)
    {
        console.log('RECEIVED SELECTED ANNOTATION: ' + aMessage);
        //Parse data
        let keys = Object.keys(aMessage)
        let values = keys.map(k => aMessage[k])
        console.log(keys)
        console.log(values)
    }

    receiveAnnotationMessageByServer(aMessage: string)
    {
        console.log('RECEIVED ANNOTATION MESSAGE: ' + aMessage);
        //Parse data
        let keys = Object.keys(aMessage)
        let values = keys.map(k => aMessage[k])
        console.log(keys)
        console.log(values)
    }
}



let annotationExperienceAPI = new AnnotationExperienceAPI("textarea",5);