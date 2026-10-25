"""Eat Healthier explainer, in the spirit of a 3Blue1Brown lesson: dark board, written-on text,
colour-coded terms, one worked example. Every scene is paced to its narration clip (vo-durations.json)."""
import json
import os

from manim import *  # noqa: F401,F403

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
D = json.load(open(os.path.join(HERE, "vo-durations.json")))
LINES = dict(json.load(open(os.path.join(HERE, "lines.json"))))
LEAD, TAIL = 0.5, 0.9  # silence before and after each narration clip, inside its scene
TAIL_FOR = {"11-close": 3.0}  # the end card holds a little longer

BG = "#1b1b1f"
WHITE = "#ECECEC"
GREY = "#8E8E93"
DIM = "#4A4A52"
BLUE = "#58C4DD"
GREEN = "#83C167"
YELLOW = "#F4D35E"
RED = "#FC6255"
ORANGE = "#F0A35E"
PINK = "#D98CE0"
TEAL = "#5CD0B3"
BRAND = "#34d399"
FONT = "Helvetica Neue"

USDA = {c["id"]: c for c in json.load(open(os.path.join(REPO, "data/usda-components.json")))["components"]}
BOWL = [("chicken_breast_grilled", 150, "grilled chicken breast", BLUE), ("brown_rice_cooked", 180, "brown rice", YELLOW), ("salad_greens", 80, "greens", GREEN)]


def T(s, size=36, color=WHITE, weight=NORMAL, **kw):
    return Text(s, font=FONT, font_size=size, color=color, weight=weight, **kw)


class Paced(Scene):
    key = None

    def setup(self):
        self.camera.background_color = BG
        self.t = 0.0
        self.wait(LEAD)
        self.t += LEAD

    def go(self, *anims, rt=1.0, **kw):
        self.play(*anims, run_time=rt, **kw)
        self.t += rt

    def hold(self, s):
        self.wait(s)
        self.t += s

    def at(self, when):
        """Wait until `when` seconds into the narration (narration starts at LEAD)."""
        target = LEAD + when
        if target > self.t:
            self.hold(target - self.t)

    def cue(self, phrase, offset=-0.15):
        """Seconds into the narration at which `phrase` is (approximately) spoken, by character position."""
        text = LINES[self.key]
        i = text.find(phrase)
        assert i >= 0, f"{self.key}: phrase not in narration: {phrase!r}"
        return max(0.0, i / len(text) * D[self.key] + offset)

    def finish(self):
        total = LEAD + D[self.key] + TAIL_FOR.get(self.key, TAIL)
        rem = total - self.t
        assert rem >= -0.05, f"{self.key}: animations run {self.t:.1f}s, narration allows {total:.1f}s"
        self.wait(max(rem, 0.0))


# ───────────────────────────── 1. the question ─────────────────────────────
class S01(Paced):
    key = "01-intro"

    def construct(self):
        q = T("What is the healthiest thing at Chipotle?", 52, weight=BOLD).to_edge(UP, buff=1.2)
        self.go(Write(q), rt=2.2)
        rows = [("Burrito Bowl", "$15.60"), ("Burrito", "$15.60"), ("Quesadilla", "$16.50"), ("Salad", "$15.60"), ("High Protein · High Fibre Bowl", "$15.60")]
        menu = VGroup()
        for name, price in rows:
            n = T(name, 32)
            p = T(price, 32, GREY)
            marks = T("?    ?    ?", 32, DIM)
            line = VGroup(n, p, marks).arrange(RIGHT, buff=0.8)
            menu.add(line)
        menu.arrange(DOWN, aligned_edge=LEFT, buff=0.42).next_to(q, DOWN, buff=0.9)
        head = VGroup(T("item", 22, GREY), T("price", 22, GREY), T("calories · protein · salt", 22, GREY)).arrange(RIGHT, buff=0.8).next_to(menu, UP, buff=0.3).align_to(menu, LEFT)
        self.at(self.cue("The menu gives you prices"))
        self.go(FadeIn(head, shift=DOWN * 0.2), LaggedStart(*[FadeIn(l, shift=RIGHT * 0.3) for l in menu], lag_ratio=0.15), rt=2.4)
        self.at(self.cue("It almost never gives you numbers"))
        self.go(*[Indicate(l[2], color=RED, scale_factor=1.15) for l in menu], rt=1.6)
        self.at(self.cue("So how could a piece"))
        big = T("?", 180, YELLOW, weight=BOLD)
        self.go(FadeOut(menu), FadeOut(head), q.animate.set_color(GREY), rt=1.0)
        self.go(GrowFromCenter(big), rt=1.0)
        self.finish()


# ───────────────────────────── 2. understanding the sentence ─────────────────────────────
class S02(Paced):
    key = "02-intent"

    def construct(self):
        sent = T("“looking for the healthiest chipotle”", 44, t2c={"healthiest": GREEN, "chipotle": BLUE}).to_edge(UP, buff=1.0)
        self.go(Write(sent), rt=2.0)
        box = RoundedRectangle(corner_radius=0.2, width=3.6, height=1.1, stroke_color=GREY, stroke_width=2)
        boxt = T("decision model", 30, GREY)
        model = VGroup(box, boxt).move_to(LEFT * 4.9 + DOWN * 0.3)
        arrow = Arrow(sent.get_bottom() + LEFT * 4.9, box.get_top(), buff=0.15, color=GREY, stroke_width=3)
        self.at(self.cue("We ask a small decision model"))
        self.go(GrowArrow(arrow), FadeIn(model), rt=1.0)
        fields = [
            ("health lens", "general healthy", 0.91, GREEN),
            ("restaurant", "chipotle", 1.0, BLUE),
            ("taste", "smoky Mexican", 0.82, ORANGE),
            ("protein", "any", 0.64, GREY),
            ("diet", "none", 0.88, GREY),
            ("budget", "none", 1.0, GREY),
        ]
        table = VGroup()
        for label, value, conf, col in fields:
            l = T(label, 26, GREY)
            v = T(value, 28, col)
            track = Line(ORIGIN, RIGHT * 1.8, stroke_color=DIM, stroke_width=6)
            fill = Line(ORIGIN, RIGHT * 1.8 * conf, stroke_color=col, stroke_width=6)
            bar = VGroup(track, fill)
            fill.align_to(track, LEFT)
            c = T(f"{conf:.2f}", 22, GREY)
            row = VGroup(l, v, bar, c)
            l.move_to(LEFT * 1.6, aligned_edge=LEFT)
            v.move_to(RIGHT * 1.2, aligned_edge=LEFT)
            bar.move_to(RIGHT * 4.0, aligned_edge=LEFT)
            c.next_to(bar, RIGHT, buff=0.25)
            table.add(row)
        table.arrange(DOWN, buff=0.38, aligned_edge=LEFT).move_to(RIGHT * 2.0 + DOWN * 0.3)
        for row in table:
            row[0].align_to(table[0][0], LEFT)
        arrows2 = Arrow(box.get_right(), table.get_left() + LEFT * 0.1, buff=0.2, color=GREY, stroke_width=3)
        self.at(self.cue("Which health lens"))
        self.go(GrowArrow(arrows2), rt=0.6)
        for row in table:
            self.go(FadeIn(row[0]), FadeIn(row[1]), Create(row[2][0]), rt=0.35)
            self.go(Create(row[2][1]), FadeIn(row[3]), rt=0.45)
        thr = DashedLine(table[0][2][0].get_left() + RIGHT * 1.8 * 0.6 + UP * 0.35, table[-1][2][0].get_left() + RIGHT * 1.8 * 0.6 + DOWN * 0.35, color=RED, stroke_width=2)
        thrt = T("threshold", 20, RED).next_to(thr, DOWN, buff=0.1)
        self.at(self.cue("anything below a threshold"))
        self.go(Create(thr), FadeIn(thrt), rt=0.8)
        self.at(self.cue("'healthiest' sets the lens"))
        self.go(Indicate(table[0][1], color=GREEN), Indicate(sent[len("“lookingforthe"):len("“lookingforthehealthiest")], color=GREEN), rt=1.2)
        self.at(self.cue("'Chipotle' becomes"))
        self.go(Indicate(table[1][1], color=BLUE), Indicate(sent[len("“lookingforthehealthiest"):len("“lookingforthehealthiestchipotle")], color=BLUE), rt=1.2)
        self.finish()


# ───────────────────────────── 3. finding candidates ─────────────────────────────
class S03(Paced):
    key = "03-search"

    def construct(self):
        title = T("549 restaurants · 54,821 menu items · crawled once, indexed once", 28, GREY).to_edge(UP, buff=0.7)
        cols, rowsn = 33, 17
        dots = VGroup(*[Dot(radius=0.055, color=DIM) for _ in range(cols * rowsn)]).arrange_in_grid(rows=rowsn, cols=cols, buff=0.22).move_to(DOWN * 0.2)
        self.go(FadeIn(title), rt=0.8)
        self.go(LaggedStart(*[FadeIn(d) for d in dots], lag_ratio=0.002), rt=3.0)
        import random

        random.seed(7)
        inner = [i for i in range(len(dots)) if 2 <= i % cols <= cols - 3 and 2 <= i // cols <= rowsn - 3]
        idx = random.sample(inner, 26)
        chip = idx[0]
        ms = T("one search: about 5 ms", 24, TEAL).next_to(title, DOWN, buff=0.18)
        self.at(self.cue("A search takes a few milliseconds"))
        self.go(FadeIn(ms), *[dots[i].animate.set_color(ORANGE).scale(1.6) for i in idx[1:]], rt=0.6)
        self.at(self.cue("The restaurant hint pulls Chipotle"))
        lab = T("Chipotle", 26, BLUE).next_to(dots[chip], UP, buff=0.25)
        self.go(dots[chip].animate.set_color(BLUE).scale(2.4), FadeIn(lab), rt=0.8)
        self.at(self.cue("That is how a Taco Bell"))
        tb = idx[5]
        lab2 = T("Taco Bell", 24, ORANGE).next_to(dots[tb], UP, buff=0.25)
        self.go(Indicate(dots[tb], color=ORANGE, scale_factor=1.8), FadeIn(lab2), rt=1.0)
        self.finish()


# ───────────────────────────── 4. decompose the item ─────────────────────────────
class S04(Paced):
    key = "04-decompose"

    def construct(self):
        name = T("High Protein · High Fibre Bowl", 44, weight=BOLD).to_edge(UP, buff=0.9)
        desc = T("Adobo chicken, light brown rice, black beans, fajita veggies,\ncorn salsa, fresh tomato salsa, romaine lettuce", 26, GREY, line_spacing=1.1).next_to(name, DOWN, buff=0.35)
        self.at(self.cue("A menu item is text"))
        self.go(Write(name), rt=1.4)
        self.at(self.cue("Take the High Protein"))
        self.go(FadeIn(desc), rt=1.0)
        cal = T("calories?", 34, RED).move_to(LEFT * 3.5 + DOWN * 0.6)
        cross = Cross(cal, stroke_color=RED, stroke_width=5)
        self.at(self.cue("We never ask the model for calories"))
        self.go(FadeIn(cal), rt=0.5)
        self.go(Create(cross), rt=0.5)
        self.at(self.cue("We ask what is in it"))
        self.go(FadeOut(cal), FadeOut(cross), rt=0.4)
        q = T("what is in it, and how much?", 30, TEAL).move_to(DOWN * 0.4)
        self.go(Write(q), rt=1.2)
        comps = VGroup()
        for cid, g, label, col in BOWL:
            box = RoundedRectangle(corner_radius=0.18, width=3.7, height=1.5, stroke_color=col, stroke_width=2.5, fill_color=col, fill_opacity=0.08)
            t1 = T(label, 26, col).move_to(box.get_center() + UP * 0.28)
            t2 = T(f"{g} g", 34, WHITE, weight=BOLD).move_to(box.get_center() + DOWN * 0.3)
            comps.add(VGroup(box, t1, t2))
        comps.arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.9)
        self.at(self.cue("It answers with three reference foods"))
        self.go(q.animate.next_to(comps, UP, buff=0.5), rt=0.6)
        for i, when in enumerate(["Grilled chicken breast", "Brown rice", "Greens, eighty"]):
            self.at(self.cue(when, -0.5))
            self.go(FadeIn(comps[i][0]), FadeIn(comps[i][1]), rt=0.5)
            self.go(Write(comps[i][2]), rt=0.6)
        self.finish()


# ───────────────────────────── 5. weighted sum ─────────────────────────────
class S05(Paced):
    key = "05-arithmetic"

    def construct(self):
        cols = [("kcal", "calories"), ("protein g", "proteinG"), ("fibre g", "fibreG"), ("sodium mg", "sodiumMg")]
        X0, XS, STEP = -6.4, -2.2, 1.9  # label column, first numeric column, column pitch
        def row(label, vals, col=WHITE, lcol=GREY, size=24, weight=NORMAL):
            cells = VGroup(T(label, size, lcol))
            cells[0].move_to(RIGHT * X0, aligned_edge=LEFT)
            for i, v in enumerate(vals):
                c = T(v, size, col, weight=weight)
                c.move_to(RIGHT * (XS + i * STEP))
                cells.add(c)
            return cells
        head = row("per 100 g", [c[0] for c in cols], GREY, GREY, 20)
        rows = VGroup(head)
        raw = [0.0] * 4
        for cid, g, label, col in BOWL:
            p = USDA[cid]["per100g"]
            vals = [p[c[1]] for c in cols]
            for i, v in enumerate(vals):
                raw[i] += v * g / 100
            rows.add(row(label, [f"{v:g}" for v in vals], WHITE, col))
        rows.arrange(DOWN, buff=0.36, aligned_edge=LEFT).to_edge(UP, buff=0.9)
        for r in rows:
            r[0].set_x(X0 + r[0].width / 2)
            for i, c in enumerate(r[1:]):
                c.set_x(XS + i * STEP)
        weights = VGroup(*[T(f"× {g}/100", 20, col) for cid, g, label, col in BOWL])
        for w, r in zip(weights, rows[1:]):
            w.move_to(RIGHT * (XS + 3 * STEP + 1.45), aligned_edge=LEFT).set_y(r.get_y())
        self.at(self.cue("Each reference food is a row"))
        self.go(FadeIn(rows[0]), rt=0.6)
        self.at(self.cue("nutrients per hundred grams"))
        self.go(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.2) for r in rows[1:]], lag_ratio=0.3), rt=1.5)
        self.at(self.cue("Multiply each row by its weight"))
        self.go(LaggedStart(*[Write(w) for w in weights], lag_ratio=0.3), rt=1.2)
        line = Line(LEFT, RIGHT, color=GREY, stroke_width=2).set_width(13.0).next_to(rows, DOWN, buff=0.22).set_x(0.1)
        sigma = T("Σ", 32, TEAL).next_to(line, DOWN, buff=0.22).set_x(X0 + 0.2)
        shown = [f"{round(raw[0])}", f"{raw[1]:.1f}", f"{raw[2]:.1f}", f"{round(raw[3])}"]
        res = VGroup(*[T(v, 30, TEAL, weight=BOLD) for v in shown])
        for i, c in enumerate(res):
            c.move_to(RIGHT * (XS + i * STEP)).set_y(sigma.get_y())
        self.at(self.cue("add them up"))
        self.go(Create(line), FadeIn(sigma), rt=0.6)
        for i, when in enumerate(["Four hundred and eighty", "fifty two grams", "about five grams of fibre", "Two honest corrections"]):
            self.at(self.cue(when))
            self.go(Write(res[i]), rt=0.6)
        notes = VGroup(
            T("salty?  p = 0.87   →   sodium + 350 + 450 · p  ≈  + 740 mg", 26, RED),
            T("calorie band 500 – 700   →   0.7 · 482 + 0.3 · 600  ≈  518   (× 1.075 on every row)", 23, YELLOW),
        ).arrange(DOWN, buff=0.3, aligned_edge=LEFT).next_to(sigma, DOWN, buff=0.7).set_x(0.1)
        self.at(self.cue("so when the model thinks"))
        self.go(Write(notes[0]), rt=1.6)
        salted = T(f"{round(raw[3]) + 740}", 30, RED, weight=BOLD).move_to(res[3])
        self.go(Transform(res[3], salted), rt=0.6)
        self.at(self.cue("And the model also guessed"))
        self.go(Write(notes[1]), rt=1.8)
        final_vals = ["518", "56.2", "4.9", "930"]
        final = VGroup(*[T(v, 34, WHITE, weight=BOLD) for v in final_vals])
        for i, c in enumerate(final):
            c.move_to(RIGHT * (XS + i * STEP)).set_y(notes.get_bottom()[1] - 0.8)
        arrow = Arrow(sigma.get_bottom() + DOWN * 0.1, [sigma.get_x(), final.get_top()[1] + 0.05, 0], buff=0.1, color=GREY, stroke_width=2)
        self.at(self.cue("That lands the bowl"))
        self.go(GrowArrow(arrow), LaggedStart(*[TransformFromCopy(res[i], final[i]) for i in range(4)], lag_ratio=0.2), rt=1.6)
        self.go(Indicate(final[3], color=RED), rt=0.8)
        self.finish()


# ───────────────────────────── 6. the score ─────────────────────────────
TERMS = [("protein", BLUE, "+18 max"), ("fibre", GREEN, "+17 max"), ("whole foods", YELLOW, "+15 max"), ("sodium", RED, "−18 max"), ("sat fat", ORANGE, "−16 max"), ("sugar", PINK, "−16 max")]


def formula(size=40):
    parts = [T("score  =  50", size), T("+", size, GREY), T("protein", size, BLUE), T("+", size, GREY), T("fibre", size, GREEN), T("+", size, GREY), T("whole foods", size, YELLOW), T("−", size, GREY), T("sodium", size, RED), T("−", size, GREY), T("sat fat", size, ORANGE), T("−", size, GREY), T("sugar", size, PINK)]
    f = VGroup(*parts).arrange(RIGHT, buff=0.28)
    if f.width > 12.6:
        f.scale_to_fit_width(12.6)
    return f


class S06(Paced):
    key = "06-score"

    def construct(self):
        f = formula(38).to_edge(UP, buff=0.8)
        self.at(self.cue("Every dish starts at fifty"))
        self.go(Write(f[0]), rt=1.2)
        self.at(self.cue("Three things earn points"))
        self.go(LaggedStart(*[Write(x) for x in f[1:7]], lag_ratio=0.25), rt=3.0)
        self.at(self.cue("Three things cost points"))
        self.go(LaggedStart(*[Write(x) for x in f[7:]], lag_ratio=0.25), rt=3.0)
        # one ramp, drawn properly: the sodium penalty
        ax = Axes(x_range=[0, 1400, 200], y_range=[-20, 2, 5], x_length=6.2, y_length=3.2, axis_config={"include_tip": False, "stroke_color": GREY, "stroke_width": 2, "font_size": 20}, tips=False).move_to(LEFT * 3.2 + DOWN * 1.0)
        xl = T("sodium (mg)", 20, GREY).next_to(ax, DOWN, buff=0.15).align_to(ax, RIGHT)
        yl = T("points", 20, GREY).next_to(ax.y_axis, LEFT, buff=0.2).rotate(PI / 2)
        pen = lambda x: 0 if x <= 550 else -min(18, (x - 550) / 650 * 18)
        curve = ax.plot(pen, x_range=[0, 1400, 10], color=RED, stroke_width=4)
        cap = T("cap", 20, RED).next_to(ax.c2p(1300, -18), UP, buff=0.1)
        kink = T("550", 20, GREY).next_to(ax.c2p(550, 0), UP, buff=0.12)
        self.at(self.cue("Every one of these is a straight line"))
        self.go(Create(ax), FadeIn(xl), FadeIn(yl), rt=1.0)
        self.go(Create(curve), FadeIn(kink), FadeIn(cap), rt=1.6)
        # ledger on the right
        ledger_rows = [("50", "start", WHITE), ("+18", "56 g protein", BLUE), ("+8.3", "4.9 g fibre", GREEN), ("+7.5", "whole grain · greens", YELLOW), ("−10.5", "928 mg sodium", RED), ("0", "2.1 g sat fat", ORANGE), ("0", "1.5 g sugar", PINK)]
        ledger = VGroup()
        for val, why, col in ledger_rows:
            v = T(val, 30, col, weight=BOLD)
            w = T(why, 22, GREY)
            v.move_to(ORIGIN, aligned_edge=RIGHT)
            w.next_to(v, RIGHT, buff=0.5)
            ledger.add(VGroup(v, w))
        ledger.arrange(DOWN, buff=0.22).move_to(RIGHT * 3.6 + DOWN * 1.0)
        for r in ledger:
            r[0].align_to(ledger[0][0], RIGHT)
            r[1].align_to(ledger[0][1], LEFT)
        total = T("50", 64).next_to(ledger, DOWN, buff=0.35).align_to(ledger[0][0], RIGHT)
        self.at(self.cue("Plug in the bowl"))
        self.go(FadeIn(ledger[0]), FadeIn(total), rt=0.6)
        dot = Dot(ax.c2p(928, pen(928)), color=RED, radius=0.09)
        run = 50
        for i, (when, add) in enumerate([("Plus eighteen", 18), ("Plus eight.", 8.3), ("Plus seven and a half", 7.5), ("Minus ten and a half", -10.5)]):
            self.at(self.cue(when))
            run += add
            anims = [FadeIn(ledger[i + 1], shift=UP * 0.15), Transform(total, T(str(round(run)), 64).move_to(total, aligned_edge=RIGHT))]
            if add == -10.5:
                anims += [FadeIn(dot), Flash(dot, color=RED)]
            self.go(*anims, rt=0.9)
        self.at(self.cue("for the salt"))
        self.go(FadeIn(ledger[5]), FadeIn(ledger[6]), rt=0.6)
        self.at(self.cue("Seventy three"))
        self.go(total.animate.set_color(GREEN).scale(1.25), rt=0.8)
        self.finish()


# ───────────────────────────── 7. compare ─────────────────────────────
class S07(Paced):
    key = "07-compare"

    def construct(self):
        f = formula(30).to_edge(UP, buff=0.6).set_opacity(0.55)
        self.add(f)
        items = [("Bowl", 73, GREEN), ("Burrito", 55, ORANGE), ("Quesadilla", 42, RED)]
        base = DOWN * 2.2
        bars = VGroup()
        for i, (name, score, col) in enumerate(items):
            x = (i - 1) * 3.6
            bar = Rectangle(width=1.6, height=score / 100 * 4.0, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to(base + RIGHT * x, aligned_edge=DOWN)
            lab = T(name, 26).next_to(bar, DOWN, buff=0.2)
            num = T(str(score), 44, col, weight=BOLD).next_to(bar, UP, buff=0.15)
            bars.add(VGroup(bar, lab, num))
        self.at(self.cue("Now compare the burrito"))
        self.go(FadeIn(bars[0]), rt=0.8)
        b = bars[1][0]
        b.save_state()
        b.stretch_to_fit_height(0.01, about_edge=DOWN)
        self.at(self.cue("More fibre"))
        self.go(FadeIn(bars[1][1]), Restore(b), FadeIn(bars[1][2]), rt=1.2)
        why = VGroup(T("+17  fibre 13 g", 24, GREEN), T("+16  protein 36 g", 24, BLUE), T("−18  sodium 2431 mg  (cap)", 24, RED), T("−13  sat fat 11.7 g  (cap)", 24, ORANGE)).arrange(DOWN, aligned_edge=LEFT, buff=0.2).next_to(bars[1], RIGHT, buff=0.9).shift(UP * 1.2)
        self.at(self.cue("decent protein"))
        self.go(FadeIn(why[0]), FadeIn(why[1]), rt=0.8)
        self.at(self.cue("two and a half grams of salt"))
        self.go(Write(why[2]), rt=0.9)
        self.at(self.cue("twelve grams of saturated fat"))
        self.go(Write(why[3]), rt=0.9)
        q = bars[2][0]
        q.save_state()
        q.stretch_to_fit_height(0.01, about_edge=DOWN)
        self.at(self.cue("The quesadilla"))
        self.go(FadeOut(why), rt=0.4)
        self.go(FadeIn(bars[2][1]), Restore(q), FadeIn(bars[2][2]), rt=1.2)
        why2 = VGroup(T("+10  protein 21 g", 24, BLUE), T("−18  sodium 1892 mg  (cap)", 24, RED), T("−13  sat fat 15.7 g  (cap)", 24, ORANGE)).arrange(DOWN, aligned_edge=LEFT, buff=0.2).next_to(bars[2], RIGHT, buff=0.6).shift(UP * 1.0)
        self.at(self.cue("with less protein"))
        self.go(LaggedStart(*[FadeIn(w) for w in why2], lag_ratio=0.3), rt=1.2)
        self.at(self.cue("Nothing here is a judgement"))
        self.go(FadeOut(why2), f.animate.set_opacity(1.0), rt=1.0)
        self.finish()


# ───────────────────────────── 8. lenses ─────────────────────────────
class S08(Paced):
    key = "08-lens"

    def construct(self):
        f = formula(38).move_to(UP * 1.6)
        self.add(f)
        chips = VGroup(*[T(s, 24, GREY) for s in ["general healthy", "blood pressure", "iron", "fatty liver", "bilirubin", "steady glucose"]]).arrange(RIGHT, buff=0.7).to_edge(DOWN, buff=1.6)
        self.at(self.cue("not the whole story"))
        self.go(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in chips], lag_ratio=0.1), rt=1.2)
        self.at(self.cue("blood pressure"))
        self.go(chips[1].animate.set_color(RED).scale(1.15), rt=0.6)
        self.go(f[8].animate.set_color("#FF3B30"), Circumscribe(f[8], color=RED, buff=0.12), rt=1.2)
        more = T("take more of   potassium-rich plants, fibre", 24, GREEN).next_to(chips, UP, buff=0.9).shift(LEFT * 0.5)
        less = T("take less of   sodium ≤ 750 mg per meal   ·   cited", 24, RED).next_to(more, DOWN, buff=0.25).align_to(more, LEFT)
        self.at(self.cue("adds take-more-of"))
        self.go(Write(more), rt=1.0)
        self.at(self.cue("take-less-of"))
        self.go(Write(less), rt=1.0)
        self.at(self.cue("The same bowl scores differently"))
        self.go(chips[1].animate.set_color(GREY).scale(1 / 1.15), chips[3].animate.set_color(ORANGE).scale(1.15), f[8].animate.set_color(RED), f[10].animate.set_color("#FF8C42"), Circumscribe(VGroup(f[10], f[11], f[12]), color=ORANGE, buff=0.12), rt=1.4)
        self.finish()


# ───────────────────────────── 9. three public rulers ─────────────────────────────
class S09(Paced):
    key = "09-indices"

    def construct(self):
        vec = T("518 kcal · 56 g protein · 4.9 g fibre · 928 mg sodium · 2.1 g sat fat · 1.5 g sugar", 24, TEAL).to_edge(UP, buff=0.8)
        self.at(self.cue("we also run the very same nutrients"))
        self.go(FadeIn(vec), rt=0.8)
        # Nutri-Score strip
        grades = ["A", "B", "C", "D", "E"]
        colors = ["#038141", "#85BB2F", "#FECB02", "#EE8100", "#E63E11"]
        strip = VGroup(*[VGroup(RoundedRectangle(corner_radius=0.12, width=0.9, height=0.9, fill_color=c, fill_opacity=0.35, stroke_width=0), T(g, 30, c, weight=BOLD)) for g, c in zip(grades, colors)]).arrange(RIGHT, buff=0.15)
        ns_label = T("Nutri-Score", 26, GREY)
        ns = VGroup(ns_label, strip).arrange(RIGHT, buff=0.8)
        # AHEI bar
        track = Line(ORIGIN, RIGHT * 4.6, stroke_color=DIM, stroke_width=10)
        fill = Line(ORIGIN, RIGHT * 4.6 * 56 / 110, stroke_color=BLUE, stroke_width=10).align_to(track, LEFT)
        ah_num = T("56 / 110", 26, BLUE).next_to(track, RIGHT, buff=0.3)
        ah = VGroup(T("Harvard AHEI", 26, GREY), VGroup(track, fill, ah_num)).arrange(RIGHT, buff=0.8)
        # Health Canada
        octo = RegularPolygon(n=8, radius=0.45, stroke_color=WHITE, stroke_width=3, fill_color="#0a0a0a", fill_opacity=1).rotate(PI / 8)
        hc_t = T("High in sodium", 26, WHITE)
        hc = VGroup(T("Health Canada", 26, GREY), VGroup(octo, hc_t).arrange(RIGHT, buff=0.3)).arrange(RIGHT, buff=0.8)
        rules = VGroup(ns, ah, hc).arrange(DOWN, buff=0.9, aligned_edge=LEFT).move_to(DOWN * 0.5)
        arrow = Arrow(vec.get_bottom(), rules.get_top() + UP * 0.1, buff=0.15, color=DIM, stroke_width=3)
        self.at(self.cue("The Nutri Score letter"))
        self.go(FadeIn(ns[0]), FadeIn(strip), GrowArrow(arrow), rt=0.8)
        self.at(self.cue("The Harvard healthy eating index"))
        self.go(FadeIn(ah[0]), Create(track), FadeIn(ah_num), rt=0.8)
        self.at(self.cue("And Health Canada's"))
        self.go(FadeIn(hc[0]), FadeIn(octo), FadeIn(hc_t), rt=0.8)
        self.at(self.cue("For this bowl: an A"))
        self.go(strip[0][0].animate.set_fill(opacity=1.0).scale(1.25), strip[0][1].animate.set_color(WHITE).scale(1.25), rt=0.6)
        self.at(self.cue("fifty six out of"))
        self.go(Create(fill), rt=1.2)
        self.at(self.cue("and a warning for sodium"))
        self.go(Indicate(hc_t, color=RED), Indicate(octo, color=RED), rt=1.0)
        self.finish()


# ───────────────────────────── 10. the restaurant ─────────────────────────────
class S10(Paced):
    key = "10-rank"

    def construct(self):
        fit = T("fit  =  protein you asked for  +  portion  +  budget  +  what you named", 30, t2c={"fit": TEAL}).to_edge(UP, buff=0.9)
        self.at(self.cue("Each dish also gets a fit score"))
        self.go(Write(fit), rt=1.8)
        rank = VGroup(T("restaurant  =  mean of best 3 mains", 34), T("( 0.6 · health  +  0.4 · fit )", 34, t2c={"health": GREEN, "fit": TEAL}), T("+ 25 if you named it   + 10 if the combo fits the budget", 26, GREY)).arrange(DOWN, buff=0.3).move_to(UP * 0.2)
        self.at(self.cue("A restaurant is ranked"))
        self.go(Write(rank[0]), rt=1.2)
        self.at(self.cue("sixty percent health"))
        self.go(Write(rank[1]), rt=1.2)
        self.at(self.cue("plus a bonus when you named it"))
        self.go(FadeIn(rank[2]), rt=0.8)
        def crow(name, price, col=WHITE, size=26, weight=NORMAL):
            n = T(name, size, col, weight=weight)
            p = T(price, size, col, weight=weight)
            n.move_to(LEFT * 4.6, aligned_edge=LEFT)
            p.move_to(RIGHT * 4.6, aligned_edge=RIGHT)
            return VGroup(n, p)
        combo = VGroup(crow("High Protein · High Fibre Bowl", "$15.60"), crow("Burrito Bowl", "$15.60"), crow("BOGO: second main free", "−$15.60", GREEN), crow("net, two people, under $40", "$15.60", WHITE, 28, BOLD)).arrange(DOWN, buff=0.22).to_edge(DOWN, buff=0.9)
        for r in combo:
            r[0].set_x(-4.6 + r[0].width / 2)
            r[1].set_x(4.6 - r[1].width / 2)
        self.at(self.cue("Then we build the cheapest combo"))
        self.go(LaggedStart(*[FadeIn(c, shift=UP * 0.1) for c in combo[:2]], lag_ratio=0.3), rt=0.8)
        self.at(self.cue("with buy-one-get-one"))
        self.go(Write(combo[2]), rt=0.8)
        self.at(self.cue("math applied"))
        self.go(FadeIn(combo[3]), rt=0.6)
        self.finish()


# ───────────────────────────── 11. close ─────────────────────────────
class S11(Paced):
    key = "11-close"

    def construct(self):
        steps = VGroup(T("sentence  →  structured question", 34), T("menu  →  weighted sum", 34), T("rank  →  a formula you can read", 34)).arrange(DOWN, buff=0.45, aligned_edge=LEFT).move_to(UP * 0.8)
        est = T("everything is an estimate, and the app says so", 26, GREY).to_edge(UP, buff=1.0)
        self.at(self.cue("Everything in there is an estimate"))
        self.go(FadeIn(est), rt=0.8)
        for i, when in enumerate(["Turn a sentence", "Turn a menu", "Rank with a formula"]):
            self.at(self.cue(when))
            self.go(Write(steps[i]), rt=1.2)
        self.at(self.cue("So, the healthiest thing at Chipotle"))
        self.go(FadeOut(steps), FadeOut(est), rt=0.6)
        card = RoundedRectangle(corner_radius=0.3, width=9.4, height=3.2, stroke_color=GREY, stroke_width=2, fill_color="#222228", fill_opacity=1).move_to(UP * 0.6)
        name = T("High Protein · High Fibre Bowl", 38, weight=BOLD).move_to(card.get_center() + UP * 0.8)
        s1 = T("73", 48, GREEN, weight=BOLD)
        s2 = T("Nutri-Score A", 30, "#038141")
        s3 = T("watch the salt · 928 mg", 30, RED)
        row = VGroup(s1, s2, s3).arrange(RIGHT, buff=0.9).move_to(card.get_center() + DOWN * 0.45)
        self.go(FadeIn(card), Write(name), rt=1.0)
        self.at(self.cue("Seventy three"))
        self.go(Write(s1), rt=0.6)
        self.at(self.cue("Nutri Score A"))
        self.go(Write(s2), rt=0.7)
        self.at(self.cue("Watch the salt"))
        self.go(Write(s3), rt=0.9)
        # end card
        tile = RoundedRectangle(corner_radius=0.3, width=1.4, height=1.4, fill_color=WHITE, fill_opacity=1, stroke_width=0)
        mark = SVGMobject(os.path.join(HERE, "mark.svg"), height=0.8).set_stroke(BRAND, width=4).set_fill(opacity=0)
        mark.move_to(tile.get_center())
        logo = VGroup(tile, mark)
        brand = T("Eat Healthier", 44, weight=BOLD)
        url = T("eat-healthier.vercel.app", 26, GREY)
        end = VGroup(logo, VGroup(brand, url).arrange(DOWN, buff=0.15, aligned_edge=LEFT)).arrange(RIGHT, buff=0.5).move_to(DOWN * 2.2)
        self.at(self.cue("Watch the salt", 1.0))
        self.go(FadeIn(end, shift=UP * 0.2), rt=1.0)
        self.finish()
