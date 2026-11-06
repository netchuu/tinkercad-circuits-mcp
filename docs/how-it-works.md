# How it works

Tinkercad does not offer an API for Circuits. Earlier tools that automate it move the mouse: search the parts panel, drag a tile onto the canvas, click one pin, then another. That breaks whenever the layout, zoom level or panel changes, and it cannot tell you which hole a leg ended up in.

This server skips the mouse for building. The Circuits editor is a single page app, and the whole circuit lives in a JavaScript object, `window.circuit_editor.data`. Everything in `src/page.ts` runs inside that page through Playwright's `page.evaluate`.

## The model

- `circuit_editor.data.devices` holds the parts. `data.createDeviceInstance(did)` adds one, where `did` is Tinkercad's device id. The parts panel shows it as the `data-did` attribute on each tile: 58422 for an LED, 132521 for the Uno, 111211 for the small breadboard.
- Every part has `terminals`, and `name2terminal` maps pin names (`anode`, `D13`, `wiper`) to them. `terminal.getBreadboardPos()` gives a terminal's position on the canvas. Ten units is one breadboard hole.
- `device.breadboard()` is the part's view: `setPos`, `setAngle`, `getPos`.
- Wires are `Circuits.BendableWireData` objects in `data.wires`. A wire with `{ insert: true }` between a part's pin and a breadboard hole is how Tinkercad records "this leg is pushed into this hole". Without those insert wires a part looks right but is not connected.
- `wire.color("red")` and `wire.addPoint(coord, index)` give a wire its colour and its bends.
- The Uno keeps its sketch in a property whose unit is `code` (`device.getCodeId()`).

## Saving

The editor records changes made between `circuit_editor.root.rec()` and `root.stopRec()` and sends them to Tinkercad's servers through a ShareJS document. That is the same path a mouse edit takes, so a circuit built this way is a normal design: it shows up in your dashboard, you can open it, change it and share it.

Some details that matter:

- `device.setCode()` changes the value in place and is not saved. Replacing the property entry (`properties.put(id, newEntry)`) is.
- Writing the code in the same edit that created a new Uno does not stick. The builder writes it in a second edit.
- Removing parts and adding new ones with the same names in a single edit fails, because the old names are still reserved. The board is cleared in its own edit first.
- `root.shareJsDoc.numberPending()` counts edits the server has not acknowledged. The server waits for it to reach zero before reloading; reloading earlier throws the edits away.

## Simulation

The simulator is driven through the normal buttons (Start Simulation, Stop Simulation) and the Code panel's Serial Monitor. After a circuit is changed the editor is reloaded, because the simulator otherwise keeps running the previous version.

Readings:

- **LEDs**: the server finds the LED's drawing on the canvas (`[id*=<view id>]` elements under `#breadboardTab svg`), takes a screenshot and averages the brightest colour channel over a few pixels of the LED body. An unlit LED reads about 128, a lit one 160-190.
- **Servos**: the horn is drawn as `.cgfx__servohorn` with `rotate(-r)`; the angle is about `(r - 4) / 0.928`.
- **Buttons**: a real mouse press on the button's drawing, held for the requested time.
- **Serial**: the text of `.js-code_panel__serial__text`, and the input box next to it for sending.
- **Ultrasonic sensor**: the target position is the `Target Y` property. Measured in the simulator, distance in cm is about `-1.108 * (Target Y + 98)`.

## Placing a part

For each part the builder:

1. creates it and names it after its `ref` (so later calls can find it),
2. applies the settings,
3. for each allowed angle, puts the part at the origin, reads where every pin ends up, shifts it so the chosen pin lands on the chosen hole and checks that every other pin is also on a hole,
4. uses the first angle that fits and adds an insert wire from each pin to its hole.

Jumper wires that start at the Uno get two or four bend points: up from the header, across above (or below) the board, and down into the hole. Each wire gets its own lane so they do not overlap.

## Adding a part

1. In the Tinkercad editor, search the part in the parts panel and read the `data-did` attribute of its tile (the browser's element inspector shows it).
2. Find its pin names: in the browser console on an open circuit run
   `d = circuit_editor.data.createDeviceInstance(<did>); [...d.name2terminal.keys()]`
   and undo afterwards.
3. Add an entry to `src/catalog.ts` with the id, label, did, aliases and pins. Offsets are only for the docs; `getBreadboardPos()` on each terminal at angle 0, divided by 10, gives them.
4. If it has a setting worth exposing, add it to `friendlyProps()` in `src/spec.ts`.
5. `npm run parts-doc`, then build a small circuit with it and simulate it.

## When Tinkercad changes

Everything above is internal to Tinkercad and can change with any release. The parts most likely to break are the CSS class names used for the Serial Monitor and the servo horn, the "Create" menu on the dashboard and the property names. `npm run smoke` exercises all of them in a couple of minutes and is the first thing to run when something stops working.
