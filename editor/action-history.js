export function actionHistory() {
  const past = [];
  const future = [];
  let head;
  let saved;
  let group;
  const encode = JSON.stringify;

  return {
    reset(document) {
      head = saved = encode(document);
      past.length = future.length = 0;
      group = undefined;
    },
    record(document, nextGroup) {
      const next = encode(document);
      if (next === head) return;
      if (nextGroup === undefined || group !== nextGroup) {
        past.push(head);
        if (past.length > 100) past.shift();
      }
      head = next;
      future.length = 0;
      group = nextGroup;
    },
    closeGroup() { group = undefined; },
    save(document) { saved = encode(document); group = undefined; },
    step(back) {
      const [from, to] = back ? [past, future] : [future, past];
      if (!from.length) return;
      to.push(head);
      head = from.pop();
      group = undefined;
      return JSON.parse(head);
    },
    get dirty() { return head !== saved; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
  };
}
