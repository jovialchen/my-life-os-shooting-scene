// room-bedroom
export const room_bedroom = {
    size: {
    width: 8,
    depth: 8,
    height: 3.5
  },
    walls: [
    {
      type: "window",
      facing: "south",
      window: {
        width: 5,
        sillHeight: 0.25,
        topHeight: 3.5
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
        width: 5,
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
