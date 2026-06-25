// room-kitchen
export const room_kitchen = {
    size: {
    width: 2.5,
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
      type: "solid",
      facing: "south"
    },
    {
      type: "solid",
      facing: "east"
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
