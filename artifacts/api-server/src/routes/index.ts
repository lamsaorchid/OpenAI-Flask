import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import postsRouter from "./posts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(botRouter);
router.use(postsRouter);

export default router;
