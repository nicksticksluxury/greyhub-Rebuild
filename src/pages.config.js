import Inventory from './pages/Inventory';
import AddWatch from './pages/AddWatch';
import WatchDetail from './pages/WatchDetail';
import Sources from './pages/Sources';
import Auctions from './pages/Auctions';
import Layout from './Layout.jsx';


export const PAGES = {
    "Inventory": Inventory,
    "AddWatch": AddWatch,
    "WatchDetail": WatchDetail,
    "Sources": Sources,
    "Auctions": Auctions,
}

export const pagesConfig = {
    mainPage: "Inventory",
    Pages: PAGES,
    Layout: Layout,
};