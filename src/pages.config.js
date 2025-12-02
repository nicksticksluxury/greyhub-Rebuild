import Inventory from './pages/Inventory';
import AddWatch from './pages/AddWatch';
import WatchDetail from './pages/WatchDetail';
import Auctions from './pages/Auctions';
import SoldInventory from './pages/SoldInventory';
import UpdateMinimumPrices from './pages/UpdateMinimumPrices';
import WatchSummary from './pages/WatchSummary';
import Settings from './pages/Settings';
import WatchSources from './pages/WatchSources';
import WatchSourceDetail from './pages/WatchSourceDetail';
import SourceWatches from './pages/SourceWatches';
import SalesTool from './pages/SalesTool';
import WhatnotSalesTool from './pages/WhatnotSalesTool';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Inventory": Inventory,
    "AddWatch": AddWatch,
    "WatchDetail": WatchDetail,
    "Auctions": Auctions,
    "SoldInventory": SoldInventory,
    "UpdateMinimumPrices": UpdateMinimumPrices,
    "WatchSummary": WatchSummary,
    "Settings": Settings,
    "WatchSources": WatchSources,
    "WatchSourceDetail": WatchSourceDetail,
    "SourceWatches": SourceWatches,
    "SalesTool": SalesTool,
    "WhatnotSalesTool": WhatnotSalesTool,
}

export const pagesConfig = {
    mainPage: "Inventory",
    Pages: PAGES,
    Layout: __Layout,
};