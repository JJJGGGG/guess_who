import './App.css'
import Rooms from "./Rooms"
import Room from "./Room"

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Game from './Game';
import Spectate from './Spectate';

const router = createBrowserRouter([
  {
    path: "/",
    element: <Rooms />,
  },
  {
    path: "/rooms/:roomId",
    element: <Room />
  },
  {
    path: "/rooms/:roomId/game",
    element: <Game />
  },
  {
    path: "/rooms/:roomId/spectate",
    element: <Spectate />
  }
]);

function App() {


  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
