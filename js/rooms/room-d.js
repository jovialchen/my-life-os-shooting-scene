// room-d
export const room_d = {
    size: {
    width: 3,
    depth: 4,
    height: 3.5
  },
    walls: [
    {
      type: "window",
      facing: "north",
      window: {
        width: 2,
        sillHeight: 0.25,
        topHeight: 3.5
      }
    },
    {
      type: "door",
      facing: "south",
      door: {
        width: 1.2,
        height: 2.4,
        openDirection: "left"
      }
    },
    {
      type: "window",
      facing: "east",
      window: {
        width: 2,
        sillHeight: 0.25,
        topHeight: 3.5
      }
    },
    {
      type: "door",
      facing: "west",
      door: {
        width: 1.2,
        height: 2.4,
        openDirection: "left"
      }
    }
  ],
    furniture: [],
    lights: [
    {
      type: "ceilingLight",
      pos: {
        x: 0,
        z: 0
      }
    }
  ],
    decorations: [],
    smallItems: [],
};
