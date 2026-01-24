'use client'
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getSports } from "@/actions/sports";
import { io } from "socket.io-client";
import { usePathname } from "next/navigation";

const SportsContext = createContext();

export const SportsProvider = ({ children }) => {
    const [sports, setSports] = useState([]);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();
    const sportsRef = useRef([]);

    const fetchSports = useCallback(async (force = false) => {
        try {
            if (!force && sportsRef.current !== null && sportsRef.current.length > 0) {
                setLoading(false); return;
            }
            const sportsData = await getSports();
            const docs = sportsData.documents || [];
            sportsRef.current = docs;
            setSports(docs);
            setLoading(false);
        }
        catch (error) {
            console.log(error);
            setLoading(false);
        }
    }, [])

    useEffect(() => {
        fetchSports();

        const allowedRoutes = ['/book-court', '/rto'];
        if (!allowedRoutes.includes(pathname)) {
            console.log(`Socket connection skipped for route: ${pathname}`);
            return;
        }

        let socket;
        try {
            socket = io();
            socket.on("connect", () => {
                console.log(`Connected to socket server on route: ${pathname}`);
            });

            socket.on("connect_error", (error) => {
                console.error("Socket connection error:", error);
            });

            socket.on("OCCUPANCY_UPDATE", () => {
                console.log("Received OCCUPANCY_UPDATE, refreshing sports...");
                fetchSports(true);
            });
        } catch (error) {
            console.error("Failed to initialize socket:", error);
        }

        return () => {
            if (socket) {
                console.log(`Disconnecting socket from route: ${pathname}`);
                socket.disconnect();
            }
        };
    }, [pathname])

    const contextValue = useMemo(() => ({
        sports,
        loading,
        setSports,
        refreshSports: fetchSports
    }), [sports, loading, fetchSports]);

    return (
        <SportsContext.Provider value={contextValue}>
            {children}
        </SportsContext.Provider>
    )
}

export const useSport = () => useContext(SportsContext);
