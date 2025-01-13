import { Outlet, useSearchParams } from "react-router-dom";

export default function Layout() {
    const [searchParams] = useSearchParams()
    return <div>
        <div className="px-12 py-8">
            <div className="text-2xl font-bold mb-4">Guess Who</div>
            {searchParams.get("playerId") && <div>Player name: {searchParams.get("playerId")}</div>}
            <Outlet />
        </div>
    </div>
}