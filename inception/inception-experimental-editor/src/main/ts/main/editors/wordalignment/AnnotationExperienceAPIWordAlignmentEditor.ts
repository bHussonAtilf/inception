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
import {AnnotationExperienceAPIImpl} from "../../../../../../../inception-api-annotation-experimental/src/main/ts/main/client/AnnotationExperienceAPIImpl";
import {Viewport} from "../../../../../../../inception-api-annotation-experimental/src/main/ts/main/client/model/Viewport";
import {Arc} from "../../../../../../../inception-api-annotation-experimental/src/main/ts/main/client/model/Arc";
import {Span} from "../../../../../../../inception-api-annotation-experimental/src/main/ts/main/client/model/Span";
import {AnnotationExperienceAPIWordAlignmentEditorVisualization} from "./visualization/AnnotationExperienceAPIWordAlignmentEditorVisualization";
import {AnnotationExperienceAPIWordAlignmentEditorActionHandler} from "./action/AnnotationExperienceAPIWordAlignmentEditorActionHandler";

export class AnnotationExperienceAPIWordAlignmentEditor {

    annotationExperienceAPI: AnnotationExperienceAPIImpl;
    annotationExperienceAPIVisualization: AnnotationExperienceAPIWordAlignmentEditorVisualization;
    annotationExperienceAPIWordAlignmentEditorActionHandler: AnnotationExperienceAPIWordAlignmentEditorActionHandler

    //States
    projectId: number;
    documentId: number;
    annotatorName: string;

    layers: [number,string][] ;

    viewport : Viewport[];
    spans: Span[];
    arcs: Arc[];
    sentences : string[];

    oddSentence: string;
    oddSentenceOffset: number = 0;
    evenSentence: string;
    evenSentenceOffset: number = 1;
    spanType : string;

    //TODO OBSERVER CLASS?


    constructor(aProjectId: number, aDocumentId: number, aAnnotatorName: string, aUrl: string)
    {
        alert("RUNNING")
        this.projectId = aProjectId;
        this.documentId = aDocumentId;
        this.annotatorName = aAnnotatorName;

        this.annotationExperienceAPI = new AnnotationExperienceAPIImpl(aProjectId, aDocumentId, aAnnotatorName, aUrl);
        this.annotationExperienceAPIVisualization = new AnnotationExperienceAPIWordAlignmentEditorVisualization(this);
        this.annotationExperienceAPIWordAlignmentEditorActionHandler = new AnnotationExperienceAPIWordAlignmentEditorActionHandler(this);

    }

    saveAlignments()
    {
        let pairs = []
        const that = this;

        if (!this.inputsValid) {
            alert("Word alignment is not 1:1.")
            return;
        }

        this.spanType = document.getElementsByClassName("filter-option-inner-inner")[0].innerText;

        let oddUnitContainerSize =  document.getElementById("odd_unit_container").children.length - 2;
        let evenUnitContainerSize = document.getElementById("even_unit_container").children.length - 2;

        for (let i = 0; i < oddUnitContainerSize; i++) {
            for (let j = 0; j < evenUnitContainerSize; j++) {

                let oddUnitContainerElementInputValue = document.getElementById("odd_unit_container").children[i + 2].children[0].value;
                let evenUnitContainerElementInputValue = document.getElementById("even_unit_container").children[j + 2].children[1].value;

                if (oddUnitContainerElementInputValue === evenUnitContainerElementInputValue) {

                    let oddUnitContainerElementText = document.getElementById("odd_unit_container").children[i + 2].children[1];
                    let evenUnitContainerElementText = document.getElementById("even_unit_container").children[j + 2].children[0];

                    let oddUnitContainerElementTextId = oddUnitContainerElementText.id.split("_");
                    let evenUnitContainerElementTextId = evenUnitContainerElementText.id.split("_");

                    pairs.push([
                        oddUnitContainerElementTextId[1],
                        evenUnitContainerElementTextId[1]]
                    );

                    this.createSpanRequest(oddUnitContainerElementTextId[1], oddUnitContainerElementTextId[2], null);
                    this.createSpanRequest(evenUnitContainerElementTextId[1], evenUnitContainerElementTextId[2], null);
                }
            }
        }

        setTimeout(function () {
            let source, target;
            for (let i = 0; i < pairs.length; i++) {
                for (let j = 0; j < that.spans.length; j++) {

                    if (pairs[i][0] == that.spans[j].begin) {
                        source = that.spans[j];
                    }
                    if (pairs[i][1] == that.spans[j].begin) {
                        target = that.spans[j];
                    }
                }
                that.annotationExperienceAPI.requestCreateArc(
                    that.annotatorName,
                    that.projectId,
                    that.documentId,
                    source.id,
                    target.id,
                    null) //TODO
            }
        }, 1500)

        document.getElementById("save_alignment").disabled = true

    }

    inputsValid()
    {
        let values = []
        if (!document.getElementById("multipleSelect").checked) {
            for (let i = 0; i < document.getElementById("even_unit_container").children.length - 2; i++) {
                if (values.indexOf(document.getElementById("even_unit_container").children[i + 2].children[1].value) > -1) {
                    return false;
                }
                values.push(document.getElementById("even_unit_container").children[i + 2].children[1].value)
            }
        }
        return true;
    }

    createSpanRequest(aBegin: string, aEnd : string, aLayer: number)
    {
        let that = this;

        this.annotationExperienceAPI.requestCreateSpan(
            that.annotatorName,
            that.projectId,
            that.documentId,
            Number(aBegin),
            Number(aEnd),
            aLayer);
    }

    resetAlignments()
    {
        let that = this;

        for (let i = 0; i < that.arcs.length; i++) {
            this.annotationExperienceAPI.requestDeleteAnnotation(
                that.annotatorName,
                that.projectId,that.documentId, that.arcs[i].id, that.arcs[i].layerId
            )
        }

        for (let i = 0; i < this.spans.length; i++) {
            that.annotationExperienceAPI.requestDeleteAnnotation(
                that.annotatorName,
                that.projectId,
                that.documentId,
                that.spans[i].id,
                that.spans[i].layerId
            )
        }
        document.getElementById("save_alignment").disabled = false;
    }
}