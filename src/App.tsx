import React from 'react';
import queryString from 'query-string';
import Button from 'react-bootstrap/Button';
import { BrowserRouter as Router, Route, useHistory, useLocation } from "react-router-dom";
import './App.scss';
import { Input } from './Inputs';
import { saveAs } from 'file-saver';

interface Arguments {
  columns: number
  columnSpacing: number
  rows: number
  rowSpacing: number

  fastFeed: number
  feed: number

  toolDiameter: number

  holeDepth: number
  holeDiameter: number

  plateDepth: number
  plateDiameter: number

  safeZ: number
}


function helixDrill(gCode: String[], diameter: number, feed: number, depth: number) {
  gCode.push("G91"); // relative positioning
  gCode.push("G0 X" + diameter / 2); // move to starting point

  // spiral down
  let z = 0;
  let toggle = -1;
  while (z < depth) {
    const zOld = z;
    z += feed / 2;
    if (z > depth)
      z = depth;
    const delta = zOld - z;

    gCode.push("G02 X" + (toggle * diameter) + "Z" + delta + " I" + (toggle * diameter / 2));
    toggle *= -1;
  }

  // final circle
  gCode.push("G02 X" + (toggle * diameter) + " I" + (toggle * diameter / 2));
  gCode.push("G02 X" + (-toggle * diameter) + " I" + (-toggle * diameter / 2));

  gCode.push("G1 X" + (toggle * diameter / 2)); // back to center
  gCode.push("G90"); // absolute positioning
}

function growCircle(gCode: String[], dStart: number, dEnd: number, increment: number) {
  gCode.push("G91"); // relative positioning
  gCode.push("G1 X" + dStart / 2); // move to starting point

  // spiral out
  let d = dStart;
  while (true) {
    gCode.push("G02 X" + (-d) + " I" + (-d / 2));
    gCode.push("G02 X" + (d) + " I" + (d / 2));
    if (d >= dEnd)
      break;
    const dOld = d;
    d += increment;
    if (d > dEnd)
      d = dEnd;
    gCode.push("G1 X" + ((d - dOld) / 2)); // move out

  }

  gCode.push("G1 X" + (-dEnd / 2)); // back to center
  gCode.push("G90"); // absolute positioning
}

function MainPage() {
  const history = useHistory();
  const location = useLocation();
  const query = queryString.parse(location.search);
  const args: Arguments = query.args === undefined ? {
    columns: 10,
    columnSpacing: 50,
    rows: 10,
    rowSpacing: 50,
    feed: 100,
    fastFeed: 1000,

    toolDiameter: 6,
    holeDepth: 22.5,
    holeDiameter: 7,
    plateDepth: 2,
    plateDiameter: 22,
    safeZ: 5,
  } : JSON.parse(decodeURIComponent(query.args as any)) as Arguments;
  const updateArgs = (x: Partial<Arguments>) => history.replace(location.pathname + "?args=" + encodeURIComponent(JSON.stringify({ ...args, ...x })));

  const iterateHoles = (func: (column: number, row: number) => void) => {
    for (let row = 0; row < args.rows; row++) {
      for (let column = 0; column < args.columns; column++) {
        func(column, row);
      }
      row++;
      if (row < args.rows) {
        for (let column = args.columns - 1; column >= 0; column--) {
          func(column, row);
        }

      }
    }
  }

  const gCode: String[] = [];
  gCode.push("G90"); // absolute positioning
  gCode.push("G21"); // mm
  gCode.push("G17"); // xy plane selection

  gCode.push('G0 F' + args.fastFeed);
  gCode.push('G1 F' + args.feed);
  gCode.push('G0 Z' + args.safeZ); // move to safe height

  iterateHoles((column, row) => {
    gCode.push("G0 X" + column * args.columnSpacing + " Y" + row * args.rowSpacing); // go to center of hole
    helixDrill(gCode, args.toolDiameter - 0.1, 1, args.plateDepth + args.safeZ); // drill to plate height
    growCircle(gCode, args.toolDiameter - 0.1 + args.toolDiameter, args.plateDiameter - args.toolDiameter, args.toolDiameter); // make room for plate
    helixDrill(gCode, args.holeDiameter - args.toolDiameter, 1, args.holeDepth - args.plateDepth); // drill hole
    gCode.push("G0 Z0"); // back to Z0
    { // take care of brims
      const d = (args.plateDiameter);
      gCode.push("G91"); // relative positioning
      gCode.push("G1 X" + d / 2);
      gCode.push("G2 X-" + d + " I-" + d / 2); // take care of brims
      gCode.push("G2 X" + d + " I" + d / 2); // take care of brims
      gCode.push("G90"); // absolute positioning
    }

    gCode.push("G0 Z" + args.safeZ);
  });

  const gCodeText = gCode.join('\n');

  return <React.Fragment>
    <h1> Arguments </h1>
    <Input type="number" label="Columns" value={'' + args.columns} onChange={p => updateArgs({ columns: parseInt(p) })} />
    <Input type="number" label="Column Spacing [mm]" value={'' + args.columnSpacing} onChange={p => updateArgs({ columnSpacing: parseFloat(p) })} />
    <Input type="number" label="rows" value={'' + args.rows} onChange={p => updateArgs({ rows: parseInt(p) })} />
    <Input type="number" label="Row Spacing [mm]" value={'' + args.rowSpacing} onChange={p => updateArgs({ rowSpacing: parseFloat(p) })} />
    <Input type="number" label="Feed" value={'' + args.feed} onChange={p => updateArgs({ feed: parseFloat(p) })} />
    <Input type="number" label="Fast Feed" value={'' + args.fastFeed} onChange={p => updateArgs({ fastFeed: parseFloat(p) })} />

    <Input type="number" label="Tool Diameter [mm]" value={'' + args.toolDiameter} onChange={p => updateArgs({ toolDiameter: parseFloat(p) })} />
    <Input type="number" label="Hole Depth [mm]" value={'' + args.holeDepth} onChange={p => updateArgs({ holeDepth: parseFloat(p) })} />
    <Input type="number" label="Hole Diameter [mm]" value={'' + args.holeDiameter} onChange={p => updateArgs({ holeDiameter: parseFloat(p) })} />
    <Input type="number" label="Plate Depth [mm]" value={'' + args.plateDepth} onChange={p => updateArgs({ plateDepth: parseFloat(p) })} />
    <Input type="number" label="PlateDiameter [mm]" value={'' + args.plateDiameter} onChange={p => updateArgs({ plateDiameter: parseFloat(p) })} />
    <Input type="number" label="SafeZ [mm]" value={'' + args.safeZ} onChange={p => updateArgs({ safeZ: parseFloat(p) })} />

    <h1> G Code</h1>
    <Button onClick={() => {
      navigator.clipboard.writeText(gCodeText);
    }}>Copy</Button>{' '}
    <Button onClick={() => {
      const blob = new Blob([gCodeText], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, 'wasteboard.nc');
    }}>Save</Button>
    <pre id="gcode">
      {gCodeText}
    </pre>
  </React.Fragment>
}

function App() {
  return <Router>
    <Route component={MainPage} />
  </Router>

}

export default App;
