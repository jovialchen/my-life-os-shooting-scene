// room-c
export const room_c = {
    size: {
    width: 2.5,
    depth: 4,
    height: 3.5
  },
    walls: [
    {
      type: "window",
      facing: "north",
      window: {
        width: 1.5,
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
      type: "door",
      facing: "east",
      door: {
        width: 1.2,
        height: 2.4,
        openDirection: "left"
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
