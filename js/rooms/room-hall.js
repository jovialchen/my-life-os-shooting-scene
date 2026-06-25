// room-hall
export const room_hall = {
    size: {
    width: 3,
    depth: 4,
    height: 3.5
  },
    walls: [
    {
      type: "solid",
      facing: "north"
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
      type: "solid",
      facing: "west"
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
