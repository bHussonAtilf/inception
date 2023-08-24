<script lang="ts">
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

    import { MTaskStateUpdate } from "./MTaskStateUpdate"
    import { onMount, onDestroy } from "svelte"
    import { Client, Stomp, IFrame } from "@stomp/stompjs"

    export let wsEndpointUrl: string // should this be full ws://... url
    export let topicChannel: string
    export let tasks: MTaskStateUpdate[] = []
    export let connected = false

    let socket: WebSocket = null
    let stompClient: Client = null
    let connectionError = null
    let popupContent: HTMLElement = null
    let popupOpen = false

    export function connect(): void {
        if (connected) {
            return;
        }

        let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        let wsEndpoint = new URL(wsEndpointUrl);
        wsEndpoint.protocol = protocol;

        stompClient = Stomp.over(
            () => (socket = new WebSocket(wsEndpoint.toString()))
        );
        stompClient.onConnect = () => {
            connected = true;
            stompClient.subscribe("/user/queue/errors", function (msg) {
                console.error(
                    "Websocket server error: " + JSON.stringify(msg.body)
                );
            });
            stompClient.subscribe(
                "/app" + topicChannel + "/tasks",
                function (msg) {
                    tasks = JSON.parse(msg.body) || []
                }
            );
            stompClient.subscribe(
                "/user/queue" + topicChannel + "/tasks",
                function (msg) {
                    var msgBody = JSON.parse(msg.body);
                    var index = tasks.findIndex(
                        (item) => item.id === msgBody.id
                    );
                    if (index === -1) {
                        if (!msgBody.removed) {
                            tasks = [msgBody, ...tasks];
                        }
                    } else {
                        if (!msgBody.removed) {
                            tasks = tasks.map((e, i) =>
                                i !== index ? e : msgBody
                            );
                        } else {
                            tasks = tasks.filter((e, i) => i !== index);
                        }
                    }
                }
            );
        };

        stompClient.onStompError = handleBrokerError;

        stompClient.activate();
    }

    export function disconnect() {
        stompClient.deactivate();
        socket.close();
        connected = false;
    }

    function handleBrokerError(receipt: IFrame) {
        console.log("Broker reported error: " + receipt.headers.message);
        console.log("Additional details: " + receipt.body);
    }

    export function closeMessages(item): void {
        item.messages = null;
    }

    onMount(async () => {
        connect();
    });

    onDestroy(async () => {
        disconnect();
    });
</script>

<div class="ms-3 float-start" on:click={() => (popupOpen = !popupOpen)}>
    <!-- svelte-ignore a11y-missing-attribute -->
    <a role="button" tabindex="0" title="Background tasks">
        {#if tasks?.find((t) => t.state === "RUNNING")}
            Processing...
            <div class="spinner-border spinner-border-sm" role="status" />
        {:else}
            Idle
        {/if}
    </a>
</div>
<div
    bind:this={popupContent}
    class:d-flex={popupOpen}
    class:d-none={!popupOpen}
    class="popup border rounded-3 bg-body d-flex shadow"
>
    <div class="popup-body flex-grow-1 d-flex">
        {#if connectionError}
            <div class="flex-content flex-h-container no-data-notice">
                {connectionError}
            </div>
        {/if}
        {#if !connected}
            <div class="flex-content flex-h-container no-data-notice">
                Connecting...
            </div>
        {/if}
        {#if connected && !tasks?.length}
            <div class="flex-content flex-h-container no-data-notice">
                No background tasks.
            </div>
        {/if}
        {#if tasks?.length}
            <ul class="list-group list-group-flush flex-grow-1">
                {#each tasks as item}
                    <li class="list-group-item p-1">
                        <div
                            class="d-flex w-100 justify-content-between fw-bold"
                        >
                            {item.title}
                            {#if item.state === 'FAILED'}
                              <i class="text-danger fas fa-exclamation-triangle" />
                            {:else if item.state === 'CANCELLED'}
                              <i class="text-secondary fas fa-ban"></i>
                            {:else if item.state === 'RUNNING'}
                              <div class="spinner-border spinner-border-sm" role="status" />
                            {:else if item.state === 'COMPLETED'}
                              <i class="text-success fas fa-check-circle"></i>
                            {/if}
                        </div>
                        {#if item.state === "RUNNING"}
                            {#if item.maxProgress}
                                <progress
                                    max={item.maxProgress}
                                    value={item.progress}
                                    class="w-100"
                                />
                            {:else}
                                <progress class="w-100" />
                            {/if}
                        {/if}
                        {#if item.latestMessage}
                            {#if item.latestMessage.level === "ERROR"}
                                <i
                                    class="text-danger fas fa-exclamation-triangle"
                                />
                            {:else if item.latestMessage.level === "WARN"}
                                <i
                                    class="text-warning fas fa-exclamation-triangle"
                                />
                            {/if}
                            {item.latestMessage.message}
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>

<style lang="scss">
    .popup {
        --bs-bg-opacity: 0.9;
        position: fixed;
        bottom: 32px;
        left: 16px;
        height: 200px;
        min-height: 200px;
        max-height: 200px;
        width: 400px;
        min-width: 400px;
        max-width: 400px;
        overflow: hidden;
    }

    .popup-body {
        text-align: initial;
        overflow-y: auto;
    }
</style>