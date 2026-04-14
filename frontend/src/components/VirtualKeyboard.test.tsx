import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VirtualKeyboard } from "./VirtualKeyboard";

describe("VirtualKeyboard", () => {
  it("renders primary keys and action keys", async () => {
    const user = userEvent.setup();
    const pressed: string[] = [];

    render(
      <VirtualKeyboard
        focusedKeyId={null}
        dwellProgress={0}
        onKeyPress={(value) => pressed.push(value)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "A" }));
    await user.click(screen.getByRole("button", { name: "ESPACIO" }));
    await user.click(screen.getByRole("button", { name: "BORRAR" }));

    expect(pressed).toEqual(["a", "space", "backspace"]);
  });
});
