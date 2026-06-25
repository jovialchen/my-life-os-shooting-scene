// room-guest
export const room_guest = {
    size: {
    width: 3.5,
    depth: 3,
    height: 3.5
  },
    walls: [
    {
      type: "door",
      facing: "north",
      door: {
        width: 1.2,
        height: 2.4,
        openDirection: "left"
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
