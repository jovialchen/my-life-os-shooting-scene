// room-a
export const room_a = {
    size: {
    width: 2.8,
    depth: 4,
    height: 3.5
  },
    walls: [
    {
      type: "window",
      facing: "north",
      window: {
        width: 1.8,
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
      type: "window",
      facing: "west",
      window: {
        width: 1.8,
        sillHeight: 0.25,
        topHeight: 3.5
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
