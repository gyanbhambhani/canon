from dataclasses import dataclass


@dataclass
class Circle:
    radius: float


@dataclass
class Rect:
    width: float
    height: float


@dataclass
class Triangle:
    base: float
    height: float


type Shape = Circle | Rect | Triangle


def area(shape: Shape) -> float:
    match shape:
        case Circle(radius):
            return 3.14159 * radius * radius
        case Rect(width, height):
            return width * height
        case Triangle(base, height):
            return base * height / 2.0


def total_area(shapes: list[Shape]) -> float:
    return sum(area(shape) for shape in shapes)
