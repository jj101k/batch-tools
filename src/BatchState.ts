/**
 *
 */
export enum BatchState {
    // The batch has been created, but nothing else.
    Initial,
    // The batch has received its first item, and any timers will have started
    Waiting,
    // The batch is ready to go. You only stay in this state where delay=true
    ReadyToSend,
    // The batch has been sent (or is in the process of being sent).
    Sent,
    // The batch results have come back.
    Finished,
}
